import {
  CompositeDidDocumentResolver,
  CompositeHandleResolver,
  LocalActorResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
  WellKnownHandleResolver,
} from "@atcute/identity-resolver";
import { NodeDnsHandleResolver } from "@atcute/identity-resolver-node";
import {
  OAuthClient,
  type ClientAssertionPrivateJwk,
  type OAuthSession,
} from "@atcute/oauth-node-client";

import { scopeList } from "./constants";
import { DynamoOAuthStore, requestOAuthLock } from "./dynamo-store";
import { isValidServerSideHandle, normalizeOAuthHandle } from "./handle";

const oauthClients = new Map<string, OAuthClient>();

export class UnsafeOAuthResourceError extends Error {
  constructor(url: string) {
    super(`Unsafe OAuth resource URL: ${url}`);
    this.name = "UnsafeOAuthResourceError";
  }
}

function getFetchUrl(input: RequestInfo | URL) {
  return new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
  );
}

function isIpv4Literal(hostname: string) {
  const parts = hostname.split(".");
  if (parts.length !== 4 || !parts.every((part) => /^\d+$/.test(part))) {
    return false;
  }

  return parts.every((part) => {
    const value = Number(part);
    return Number.isInteger(value) && value >= 0 && value <= 255;
  });
}

function isIpLiteral(hostname: string) {
  return isIpv4Literal(hostname) || hostname.includes(":");
}

function isUnsafeHost(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const normalizedHost = normalizeOAuthHandle(host);

  return (
    !normalizedHost ||
    isIpLiteral(host) ||
    !isValidServerSideHandle(normalizedHost)
  );
}

export function isSafeOAuthResourceUrl(value: string | URL) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  return (
    url.protocol === "https:" &&
    url.username === "" &&
    url.password === "" &&
    !isUnsafeHost(url.hostname)
  );
}

export function assertSafeOAuthResourceUrl(value: string | URL) {
  if (!isSafeOAuthResourceUrl(value)) {
    throw new UnsafeOAuthResourceError(String(value));
  }
}

export const guardedOAuthFetch: typeof fetch = (input, init) => {
  const url = getFetchUrl(input);
  assertSafeOAuthResourceUrl(url);
  return fetch(input, init);
};

export const guardedWellKnownFetch: typeof fetch = (input, init) => {
  const url = new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
  );
  const handle = normalizeOAuthHandle(url.hostname);

  if (!handle || !isValidServerSideHandle(handle)) {
    throw new TypeError("Blocked unsafe handle resolution request");
  }

  return guardedOAuthFetch(input, init);
};

export function getPublicJwks() {
  const privateKeyRaw = process.env.OAUTH_PRIVATE_KEY_JWK;
  if (!privateKeyRaw) {
    throw new Error("OAUTH_PRIVATE_KEY_JWK is not set");
  }

  const privateKey = JSON.parse(privateKeyRaw);
  const { d: _d, ...publicKey } = privateKey;
  if (!publicKey.kid) publicKey.kid = "k1";
  if (!publicKey.alg) publicKey.alg = "ES256";
  return { keys: [publicKey] };
}

export async function getOAuthClient(origin: string) {
  if (oauthClients.has(origin)) {
    return oauthClients.get(origin)!;
  }

  const privateKeyRaw = process.env.OAUTH_PRIVATE_KEY_JWK;
  if (!privateKeyRaw) {
    throw new Error("OAUTH_PRIVATE_KEY_JWK is not set");
  }

  const privateKey: ClientAssertionPrivateJwk = {
    ...JSON.parse(privateKeyRaw),
    kid: "k1",
    alg: "ES256",
  };

  const client = new OAuthClient({
    fetch: guardedOAuthFetch,
    metadata: {
      client_id: `${origin}/oauth-client-metadata.json`,
      redirect_uris: [`${origin}/api/oauth/callback`],
      jwks_uri: `${origin}/api/oauth/jwks.json`,
      scope: scopeList,
    },
    keyset: [privateKey],
    stores: {
      sessions: new DynamoOAuthStore("session"),
      states: new DynamoOAuthStore("state"),
    },
    requestLock: requestOAuthLock,
    actorResolver: new LocalActorResolver({
      handleResolver: new CompositeHandleResolver({
        methods: {
          dns: new NodeDnsHandleResolver(),
          http: new WellKnownHandleResolver({ fetch: guardedWellKnownFetch }),
        },
      }),
      didDocumentResolver: new CompositeDidDocumentResolver({
        methods: {
          plc: new PlcDidDocumentResolver({ fetch: guardedOAuthFetch }),
          web: new WebDidDocumentResolver({ fetch: guardedOAuthFetch }),
        },
      }),
    }),
  });

  oauthClients.set(origin, client);
  return client;
}

export async function restoreSession(oauth: OAuthClient, did: string): Promise<OAuthSession> {
  const session = await oauth.restore(did as never, { refresh: false });
  const tokenInfo = await session.getTokenInfo(false);
  assertSafeOAuthResourceUrl(tokenInfo.aud);
  return session;
}

export async function getSafeTokenInfo(session: OAuthSession) {
  const tokenInfo = await session.getTokenInfo();
  assertSafeOAuthResourceUrl(tokenInfo.aud);
  return tokenInfo;
}

export function isUnsafeOAuthResourceError(error: unknown) {
  return error instanceof UnsafeOAuthResourceError;
}

export function isDeletedSessionError(error: unknown) {
  const err = error as { name?: string; message?: string };
  return (
    err?.name === "TokenRefreshError" ||
    err?.message?.includes("session was deleted") ||
    err?.message?.includes("session not found")
  );
}
