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

const oauthClients = new Map<string, OAuthClient>();

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
          http: new WellKnownHandleResolver({ fetch }),
        },
      }),
      didDocumentResolver: new CompositeDidDocumentResolver({
        methods: {
          plc: new PlcDidDocumentResolver({ fetch }),
          web: new WebDidDocumentResolver({ fetch }),
        },
      }),
    }),
  });

  oauthClients.set(origin, client);
  return client;
}

export async function restoreSession(oauth: OAuthClient, did: string): Promise<OAuthSession> {
  return oauth.restore(did as never);
}

export function isDeletedSessionError(error: unknown) {
  const err = error as { name?: string; message?: string };
  return (
    err?.name === "TokenRefreshError" ||
    err?.message?.includes("session was deleted") ||
    err?.message?.includes("session not found")
  );
}
