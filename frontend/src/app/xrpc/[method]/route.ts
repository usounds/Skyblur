import { Client, type ServiceProxyOptions } from "@atcute/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getOAuthClient, isDeletedSessionError, restoreSession } from "@/logic/oauth/client";
import { OAUTH_DID_COOKIE, verifySignedDid } from "@/logic/oauth/cookies";
import { getRequestOrigin } from "@/logic/oauth/origin";

const bskyAppViewProxy: ServiceProxyOptions = {
  did: "did:web:api.bsky.app" as never,
  serviceId: "#bsky_appview",
};

const publicSkyblurMethods = new Set([
  "uk.skyblur.post.decryptByCid",
]);

const optionalSessionSkyblurMethods = new Set([
  "uk.skyblur.post.getPost",
]);

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

  return "https://api.skyblur.uk";
}

function getSkyblurProxyDid(request: Request) {
  const host = new URL(getRequestOrigin(request)).host;
  return `did:web:${host}`;
}

function getProxyForMethod(request: Request, method: string): ServiceProxyOptions | null {
  if (method.startsWith("app.bsky.")) {
    return bskyAppViewProxy;
  }

  if (method.startsWith("uk.skyblur.")) {
    return {
      did: getSkyblurProxyDid(request) as never,
      serviceId: "#skyblur_api",
    };
  }

  return null;
}

async function getSessionClient(request: Request, method: string) {
  const rawDid = (await cookies()).get(OAUTH_DID_COOKIE)?.value;
  const did = verifySignedDid(rawDid ? decodeURIComponent(rawDid) : rawDid);

  if (!did) return null;

  const oauth = await getOAuthClient(getRequestOrigin(request));
  let session;
  try {
    session = await restoreSession(oauth, did);
  } catch (error) {
    if (isDeletedSessionError(error)) return null;
    throw error;
  }

  return new Client({
    handler: session,
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

function upstreamFetchFailedResponse(method: string, mode: string) {
  return NextResponse.json(
    { error: "UpstreamFetchFailed", message: "Upstream service request failed" },
    {
      status: 502,
      headers: {
        "Cache-Control": "no-store",
        "x-skyblur-xrpc-mode": mode,
        "x-skyblur-xrpc-method": method,
        "x-skyblur-upstream-error": "fetch_failed",
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

function sessionProxyResponse(method: string, response: any) {
  const authError = sanitizeHeaderValue(response.headers?.get?.("www-authenticate") ?? null);
  const xrpcError = getXrpcErrorName(response.data);

  return NextResponse.json(response.data, {
    status: response.ok ? 200 : response.status,
    headers: {
      "Cache-Control": "no-store",
      "x-skyblur-xrpc-mode": "session-proxy",
      "x-skyblur-xrpc-method": method,
      "x-skyblur-upstream-status": String(response.status),
      ...(authError ? { "x-skyblur-upstream-auth-error": authError } : {}),
      ...(xrpcError ? { "x-skyblur-upstream-xrpc-error": xrpcError } : {}),
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

async function publicSkyblurResponse(request: Request, method: string) {
  const url = new URL(request.url);
  const upstreamUrl = new URL(`/xrpc/${method}`, getSkyblurApiOrigin(request));
  upstreamUrl.search = url.search;

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
  const client = optionalSession
    ? await getOptionalSessionClient(request, method)
    : await getSessionClient(request, method);

  if (!client) {
    if (optionalSession) {
      return publicSkyblurResponse(request, method);
    }
    return localAuthMissingResponse(method);
  }

  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  let response;
  try {
    response = await (client as any).get(method, { params });
  } catch (error) {
    if (isUpstreamFetchError(error)) {
      return upstreamFetchFailedResponse(method, "session-proxy");
    }
    throw error;
  }
  return sessionProxyResponse(method, response);
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
  const client = optionalSession
    ? await getOptionalSessionClient(request, method)
    : await getSessionClient(request, method);

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
    response = await (client as any).post(method, {
      input,
      encoding: isJson ? undefined : contentType,
      headers: isJson ? undefined : { "Content-Type": contentType },
    });
  } catch (error) {
    if (isUpstreamFetchError(error)) {
      return upstreamFetchFailedResponse(method, "session-proxy");
    }
    throw error;
  }

  return sessionProxyResponse(method, response);
}
