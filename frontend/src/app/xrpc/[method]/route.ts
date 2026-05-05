import { Client, type ServiceProxyOptions } from "@atcute/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  getOAuthClient,
  isDeletedSessionError,
  isUnsafeOAuthResourceError,
  restoreSession,
} from "@/logic/oauth/client";
import { OAUTH_DID_COOKIE, verifySignedDid } from "@/logic/oauth/cookies";
import { getRequestOrigin } from "@/logic/oauth/origin";

const publicSkyblurMethods = new Set([
  "uk.skyblur.post.decryptByCid",
]);

const optionalSessionSkyblurMethods = new Set([
  "uk.skyblur.post.getPost",
]);

const bskyAppViewProxy: ServiceProxyOptions = {
  did: "did:web:api.bsky.app" as never,
  serviceId: "#bsky_appview",
};

const searchPostsMethod = "app.bsky.feed.searchPosts";
const retryableAppBskyGetMethods = new Set([
  searchPostsMethod,
  "app.bsky.graph.getLists",
  "app.bsky.graph.getList",
]);
const searchPostsTimeoutMs = 10_000;
const searchPostsMaxAttempts = 2;
const appBskyPipelineTimeoutMs = 10_000;
const e2ePipelineDelayParam = "__e2ePipelineDelayMs";

type XrpcDiagnostics = {
  startedAt: number;
  attempt?: number;
  proxy?: string;
  stage?: "pipeline-delay" | "session" | "upstream";
  sessionMs?: number;
  upstreamMs?: number;
};

class XrpcPipelineTimeoutError extends Error {
  constructor() {
    super("XRPC session proxy pipeline timed out");
    this.name = "XrpcPipelineTimeoutError";
  }
}

function isAppBskyMethod(method: string) {
  return method.startsWith("app.bsky.");
}

function isTimeoutError(error: unknown) {
  return (
    error instanceof XrpcPipelineTimeoutError ||
    (error instanceof Error && error.name === "AbortError")
  );
}

async function withPipelineTimeout<T>(
  timeoutMs: number,
  fn: (signal: AbortSignal) => Promise<T>,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abortPromise = new Promise<never>((_, reject) => {
    controller.signal.addEventListener("abort", () => reject(new XrpcPipelineTimeoutError()), {
      once: true,
    });
  });

  try {
    return await Promise.race([fn(controller.signal), abortPromise]);
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForSignal(ms: number, signal: AbortSignal) {
  if (ms <= 0) return;
  if (signal.aborted) throw new XrpcPipelineTimeoutError();

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(new XrpcPipelineTimeoutError());
      },
      { once: true },
    );
  });
}

function getE2ePipelineDelayMs(request: Request) {
  if (process.env.E2E_TEST !== "true") return 0;

  const raw = new URL(request.url).searchParams.get(e2ePipelineDelayParam);
  const delayMs = raw ? Number(raw) : 0;
  return Number.isFinite(delayMs) && delayMs > 0 ? Math.min(delayMs, 30_000) : 0;
}

function getSkyblurApiOrigin(request: Request) {
  if (process.env.SKYBLUR_API_ORIGIN) {
    return process.env.SKYBLUR_API_ORIGIN.replace(/\/+$/, "");
  }

  const host = new URL(getRequestOrigin(request)).host;

  if (host.includes("localhost") || host.includes("127.0.0.1")) {
    return "http://localhost:8787";
  }

  if (host === "dev.skyblur.uk") {
    return "https://devapi.skyblur.uk";
  }

  if (host === "preview.skyblur.uk") {
    return "https://previewapi.skyblur.uk";
  }

  return "https://api.skyblur.uk";
}

function getSkyblurProxyDid(request: Request) {
  const host = new URL(getRequestOrigin(request)).host;
  return `did:web:${host}`;
}

function getProxyForMethod(request: Request, method: string): ServiceProxyOptions | null {
  if (method.startsWith("uk.skyblur.")) {
    return {
      did: getSkyblurProxyDid(request) as never,
      serviceId: "#skyblur_api",
    };
  }

  if (isAppBskyMethod(method)) {
    return bskyAppViewProxy;
  }

  return null;
}

function getProxyHeaderValue(proxy: ServiceProxyOptions | null) {
  if (!proxy) return null;
  return `${proxy.did}${proxy.serviceId}`;
}

async function getOAuthSession(request: Request) {
  const rawDid = (await cookies()).get(OAUTH_DID_COOKIE)?.value;
  const did = verifySignedDid(rawDid ? decodeURIComponent(rawDid) : rawDid);

  if (!did) return null;

  const oauth = await getOAuthClient(getRequestOrigin(request));

  let session;
  try {
    session = await restoreSession(oauth, did);
  } catch (error) {
    if (isDeletedSessionError(error) || isUnsafeOAuthResourceError(error)) return null;
    throw error;
  }

  return { did, session };
}

async function getSessionClient(request: Request, method: string) {
  const oauthSession = await getOAuthSession(request);
  if (!oauthSession) return null;

  return new Client({
    handler: oauthSession.session,
    proxy: getProxyForMethod(request, method),
  });
}

async function getOptionalSessionClient(request: Request, method: string) {
  try {
    return await getSessionClient(request, method);
  } catch (error) {
    console.warn(`[xrpc] Falling back to public Skyblur fetch for ${method}:`, error);
    return null;
  }
}

function sanitizeHeaderValue(value: string | null) {
  if (!value) return null;
  return value
    .replace(/nonce="[^"]*"/gi, 'nonce="<redacted>"')
    .replace(/token="[^"]*"/gi, 'token="<redacted>"')
    .replace(/access_token="[^"]*"/gi, 'access_token="<redacted>"')
    .slice(0, 240);
}

function getXrpcErrorName(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const error = (data as { error?: unknown }).error;
  return typeof error === "string" ? error.slice(0, 80) : null;
}

function isUpstreamFetchError(error: unknown) {
  const err = error as {
    name?: string;
    message?: string;
    cause?: { code?: string };
  };
  return (
    err?.name === "TypeError" &&
    err?.message === "fetch failed" &&
    typeof err?.cause?.code === "string"
  );
}

function upstreamFetchFailedResponse(method: string, mode: string, diagnostics?: XrpcDiagnostics) {
  return NextResponse.json(
    { error: "UpstreamFetchFailed", message: "Upstream service request failed" },
    {
      status: 502,
      headers: {
        "Cache-Control": "no-store",
        "x-skyblur-xrpc-mode": mode,
        "x-skyblur-xrpc-method": method,
        "x-skyblur-upstream-error": "fetch_failed",
        ...getDiagnosticHeaders(diagnostics),
      },
    },
  );
}

function getDiagnosticHeaders(diagnostics?: XrpcDiagnostics) {
  if (!diagnostics) return {};

  return {
    "x-skyblur-xrpc-elapsed-ms": String(Date.now() - diagnostics.startedAt),
    ...(diagnostics.attempt ? { "x-skyblur-xrpc-attempt": String(diagnostics.attempt) } : {}),
    ...(diagnostics.proxy ? { "x-skyblur-atproto-proxy": diagnostics.proxy } : {}),
    ...(diagnostics.stage ? { "x-skyblur-xrpc-stage": diagnostics.stage } : {}),
    ...(diagnostics.sessionMs != null ? { "x-skyblur-xrpc-session-ms": String(diagnostics.sessionMs) } : {}),
    ...(diagnostics.upstreamMs != null ? { "x-skyblur-xrpc-upstream-ms": String(diagnostics.upstreamMs) } : {}),
  };
}

function upstreamTimeoutResponse(method: string, mode: string, diagnostics?: XrpcDiagnostics) {
  return NextResponse.json(
    { error: "UpstreamTimeout", message: "Upstream service request timed out" },
    {
      status: 504,
      headers: {
        "Cache-Control": "no-store",
        "x-skyblur-xrpc-mode": mode,
        "x-skyblur-xrpc-method": method,
        "x-skyblur-upstream-error": "timeout",
        ...getDiagnosticHeaders(diagnostics),
      },
    },
  );
}

async function publicSkyblurErrorResponse(method: string, response: Response) {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  let errorBody: unknown = null;

  if (isJson && response.status < 500) {
    try {
      errorBody = await response.json();
    } catch {
      errorBody = null;
    }
  }

  return NextResponse.json(errorBody ?? {
    error: "UpstreamSkyblurError",
    message: "System error. Please try again later.",
    upstreamStatus: response.status,
  }, {
    status: response.status,
    headers: {
      "Cache-Control": "no-store",
      "x-skyblur-xrpc-mode": "public-skyblur",
      "x-skyblur-xrpc-method": method,
      "x-skyblur-upstream-status": String(response.status),
      "x-skyblur-upstream-content-type": contentType || "unknown",
    },
  });
}

function sessionProxyResponse(method: string, response: any, diagnostics?: XrpcDiagnostics) {
  const authError = sanitizeHeaderValue(response.headers?.get?.("www-authenticate") ?? null);
  const xrpcError = getXrpcErrorName(response.data);
  const dpopNonce = response.headers?.get?.("dpop-nonce") ? "present" : null;

  return NextResponse.json(response.data, {
    status: response.ok ? 200 : response.status,
    headers: {
      "Cache-Control": "no-store",
      "x-skyblur-xrpc-mode": "session-proxy",
      "x-skyblur-xrpc-method": method,
      "x-skyblur-upstream-status": String(response.status),
      ...(authError ? { "x-skyblur-upstream-auth-error": authError } : {}),
      ...(xrpcError ? { "x-skyblur-upstream-xrpc-error": xrpcError } : {}),
      ...(dpopNonce ? { "x-skyblur-upstream-dpop-nonce": dpopNonce } : {}),
      ...getDiagnosticHeaders(diagnostics),
    },
  });
}

function localAuthMissingResponse(method: string) {
  return NextResponse.json(
    { error: "Authentication required" },
    {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
        "x-skyblur-xrpc-mode": "local-auth-missing",
        "x-skyblur-xrpc-method": method,
      },
    },
  );
}

function getXrpcQueryParams(request: Request) {
  const url = new URL(request.url);
  const params: Record<string, string> = {};

  for (const [key, value] of url.searchParams.entries()) {
    if (key === e2ePipelineDelayParam) continue;
    const normalizedValue = key === "q" ? value.trim() : value;
    if (normalizedValue === "") continue;
    params[key] = normalizedValue;
  }

  return params;
}

function sanitizeDiagnosticParams(params: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [
      key,
      value.length > 120 ? `${value.slice(0, 120)}...` : value,
    ]),
  );
}

function getErrorDiagnostic(error: unknown) {
  const err = error as {
    name?: string;
    message?: string;
    cause?: { code?: string };
  };

  return {
    name: err?.name || "UnknownError",
    message: err?.message?.slice(0, 240) || "",
    causeCode: err?.cause?.code || null,
  };
}

function logSearchPostsResponse(params: Record<string, string>, startedAt: number, response: any) {
  console.warn("[xrpc] searchPosts upstream response", {
    method: searchPostsMethod,
    params: sanitizeDiagnosticParams(params),
    elapsedMs: Date.now() - startedAt,
    status: response.status,
    ok: response.ok,
    authError: sanitizeHeaderValue(response.headers?.get?.("www-authenticate") ?? null),
    dpopNonce: response.headers?.get?.("dpop-nonce") ? "present" : "absent",
    xrpcError: getXrpcErrorName(response.data),
  });
}

function logSearchPostsError(params: Record<string, string>, startedAt: number, error: unknown) {
  console.warn("[xrpc] searchPosts upstream error", {
    method: searchPostsMethod,
    params: sanitizeDiagnosticParams(params),
    elapsedMs: Date.now() - startedAt,
    error: getErrorDiagnostic(error),
  });
}

async function publicSkyblurResponse(request: Request, method: string) {
  const url = new URL(request.url);
  const upstreamUrl = new URL(`/xrpc/${method}`, getSkyblurApiOrigin(request));
  for (const [key, value] of url.searchParams.entries()) {
    if (value === "") continue;
    upstreamUrl.searchParams.set(key, value);
  }

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }

  let response;
  try {
    response = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
    });
  } catch (error) {
    if (isUpstreamFetchError(error)) {
      return upstreamFetchFailedResponse(method, "public-skyblur");
    }
    throw error;
  }

  if (!response.ok) {
    return publicSkyblurErrorResponse(method, response);
  }

  return new NextResponse(response.body, {
    status: response.status,
    headers: {
      "Cache-Control": "no-store",
      "content-type": response.headers.get("content-type") || "application/json",
      "x-skyblur-xrpc-mode": "public-skyblur",
      "x-skyblur-xrpc-method": method,
      "x-skyblur-upstream-status": String(response.status),
    },
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ method: string }> },
) {
  const { method } = await context.params;

  if (publicSkyblurMethods.has(method)) {
    return publicSkyblurResponse(request, method);
  }

  const optionalSession = optionalSessionSkyblurMethods.has(method);
  const params = getXrpcQueryParams(request);
  let response;
  const isSearchPosts = method === searchPostsMethod;
  const isAppBsky = isAppBskyMethod(method);
  const startedAt = Date.now();
  const maxAttempts = retryableAppBskyGetMethods.has(method) ? searchPostsMaxAttempts : 1;
  const e2ePipelineDelayMs = getE2ePipelineDelayMs(request);
  const diagnostics: XrpcDiagnostics = {
    startedAt,
    proxy: getProxyHeaderValue(getProxyForMethod(request, method)) ?? undefined,
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    diagnostics.attempt = attempt;
    const abortController = isSearchPosts && !isAppBsky ? new AbortController() : null;
    const timeout = abortController ? setTimeout(() => abortController.abort(), searchPostsTimeoutMs) : null;

    try {
      const runSessionProxyGet = async (signal?: AbortSignal) => {
        if (signal) {
          diagnostics.stage = "pipeline-delay";
          await waitForSignal(e2ePipelineDelayMs, signal);
        }

        diagnostics.stage = "session";
        const sessionStartedAt = Date.now();
        const client = optionalSession
          ? await getOptionalSessionClient(request, method)
          : await getSessionClient(request, method);
        diagnostics.sessionMs = Date.now() - sessionStartedAt;

        if (!client) {
          if (optionalSession) {
            return publicSkyblurResponse(request, method);
          }
          return localAuthMissingResponse(method);
        }

        diagnostics.stage = "upstream";
        const upstreamStartedAt = Date.now();
        const result = await (client as any).get(method, {
          params,
          ...(signal ? { signal } : {}),
          ...(abortController ? { signal: abortController.signal } : {}),
        });
        diagnostics.upstreamMs = Date.now() - upstreamStartedAt;
        return result;
      };

      response = isAppBsky
        ? await withPipelineTimeout(appBskyPipelineTimeoutMs, runSessionProxyGet)
        : await runSessionProxyGet();
      if (response instanceof NextResponse) {
        return response;
      }
      if (isSearchPosts) {
        logSearchPostsResponse(params, startedAt, response);
      }
      break;
    } catch (error) {
      if (isSearchPosts) {
        logSearchPostsError(params, startedAt, error);
      }
      if (isTimeoutError(error)) {
        if (attempt < maxAttempts) {
          continue;
        }
        return upstreamTimeoutResponse(method, "session-proxy", diagnostics);
      }
      if (isUpstreamFetchError(error)) {
        return upstreamFetchFailedResponse(method, "session-proxy", diagnostics);
      }
      throw error;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  return sessionProxyResponse(method, response, diagnostics);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ method: string }> },
) {
  const { method } = await context.params;

  if (publicSkyblurMethods.has(method)) {
    return publicSkyblurResponse(request, method);
  }

  const optionalSession = optionalSessionSkyblurMethods.has(method);
  const diagnostics: XrpcDiagnostics = {
    startedAt: Date.now(),
    proxy: getProxyHeaderValue(getProxyForMethod(request, method)) ?? undefined,
  };
  diagnostics.stage = "session";
  const sessionStartedAt = Date.now();
  const client = optionalSession
    ? await getOptionalSessionClient(request, method)
    : await getSessionClient(request, method);
  diagnostics.sessionMs = Date.now() - sessionStartedAt;

  if (!client) {
    if (optionalSession) {
      return publicSkyblurResponse(request, method);
    }
    return localAuthMissingResponse(method);
  }

  const contentType = request.headers.get("content-type") || "application/json";
  const isJson = contentType.includes("application/json");
  const input = isJson ? await request.json() : new Uint8Array(await request.arrayBuffer());
  let response;
  try {
    diagnostics.stage = "upstream";
    const upstreamStartedAt = Date.now();
    response = await (client as any).post(method, {
      input,
      encoding: isJson ? undefined : contentType,
      headers: isJson ? undefined : { "Content-Type": contentType },
    });
    diagnostics.upstreamMs = Date.now() - upstreamStartedAt;
  } catch (error) {
    if (isUpstreamFetchError(error)) {
      return upstreamFetchFailedResponse(method, "session-proxy", diagnostics);
    }
    throw error;
  }

  return sessionProxyResponse(method, response, diagnostics);
}
