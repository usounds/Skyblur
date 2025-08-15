import { fetchAuthorizationServer } from "@/logic/HandleXrpcProxy";
import { jwks } from '@/types/ClientMetadataContext';
import { DIDDocument, Service } from '@/types/types';
import { Client, simpleFetchHandler } from '@atcute/client';
import { ActorIdentifier } from '@atcute/lexicons/syntax';
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as jose from 'jose';

export async function GET(request: Request) {
  const url = new URL(request.url);

  const myKv = getCloudflareContext().env.SKYBLUR_OAUTH;

  const handle = url.searchParams.get('handle');

  // Hanldle -> DID
  const publicAgent = new Client({
    handler: simpleFetchHandler({
      service: 'https://public.api.bsky.app',
    }),
  })

  const profile = await publicAgent.get('app.bsky.actor.getProfile', {
    params: {
      actor: handle as ActorIdentifier,
    },
  });

  if (!profile.ok) return new Response(null, {
    status: 404,
  });

  const did = profile.data.did

  const origHost = new URL(request.url);
  const host = origHost.host; // host だけ取得
  let apiHost = 'api.skyblur.uk'
  if (host?.includes('localhost')) {
    apiHost = 'skyblurapi.usounds.work'
  }

  // DID -> Service Endpoint
  const ret = await fetch(`https://${apiHost}/xrpc/uk.skyblur.admin.getDidDocument?actor=${did}&forceRefresh=true`)
  const didDoc = await ret.json() as DIDDocument;
  const endpoint =
    didDoc.service?.find((svc: Service) => svc.id === '#atproto_pds')
      ?.serviceEndpoint || '';

  // Service Endpoint -> oauth-protected-resource
  let oauthProtectResourceRaw: string | null = await myKv.get(`oauth-protected-resource:${endpoint}`);

  if (!oauthProtectResourceRaw) {
    // fetch して文字列を取得
    console.log('endpoint:' + endpoint)
    const res = await fetch(`${endpoint}/.well-known/oauth-protected-resource`);
    if (!res.ok) throw new Error("Failed to fetch oauth-protected-resource");

    oauthProtectResourceRaw = await res.text();

    // KV に文字列として保存
    await myKv.put(`oauth-protected-resource:${endpoint}`, oauthProtectResourceRaw);
  }

  // JSON にパースして型を付与
  const oauthProtectResource: { authorization_servers: string[] } = JSON.parse(oauthProtectResourceRaw);

  const authorizationServers = oauthProtectResource.authorization_servers[0]
  const data = await fetchAuthorizationServer(myKv, authorizationServers)

  // oauth-protected-resource -> oauth-authorization-server

  const login_hint = handle;
  const token_endpoint = data.token_endpoint;
  const authorization_endpoint = data.authorization_endpoint;
  const issuer = data.issuer;
  const pds = endpoint;

  if (!login_hint || !token_endpoint || !authorization_endpoint || !issuer || !pds) {
    return new Response('Missing parameters', { status: 400 });
  }
  // サーバー側で秘密鍵を使って client_assertion を生成
  const d = getCloudflareContext().env.JWT_SECRET;
  const privateJwk = {
    ...jwks.keys[0],
    d, // ここで秘密鍵を追加
  };
  const key = await jose.importJWK(privateJwk, "ES256");

  const client_id = `https://${getCloudflareContext().env.APP_VIEW_URL}/api/client-metadata.json`

  const now = Math.floor(Date.now() / 1000);
  const clientAssertion = await new jose.SignJWT({
    sub: client_id,
    iss: client_id,
    aud: token_endpoint,
    jti: crypto.randomUUID(),
  })
    .setProtectedHeader({ alg: "ES256", typ: "JWT", kid: privateJwk.kid })
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(key);

  // PKCE を生成
  // 128バイトのランダム値を生成して、Base64URL エンコード
  function generateCodeVerifier(): string {
    const array = new Uint8Array(64); // 64バイト = 86文字くらいになる
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  // 使い方
  const codeVerifier = generateCodeVerifier();

  // SHA-256 を使って code_challenge を生成
  const codeChallengeBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier)
  );
  const code_challenge = btoa(
    String.fromCharCode(...new Uint8Array(codeChallengeBuffer))
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  // state はそのまま UUID でOK
  const state = crypto.randomUUID();

  // 認可 URL を生成
  const params = new URLSearchParams({
    client_id: client_id,
    redirect_uri: `https://${getCloudflareContext().env.APP_VIEW_URL}/api/oauth/callback`,
    response_type: "code",
    scope: "atproto transition:generic",
    code_challenge,
    code_challenge_method: "S256",
    state,
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: clientAssertion,
    login_hint: login_hint,
  });

  const redirectUrl = `${authorization_endpoint}?${params.toString()}`;

  // code_verifier をクッキーに保存
  const headers = new Headers();
  headers.append('Set-Cookie', `oauth_code_verifier=${codeVerifier}; HttpOnly; Secure; Path=/; SameSite=Lax`);
  headers.append('Set-Cookie', `oauth_issuer=${encodeURIComponent(issuer || '')}; HttpOnly; Secure; Path=/; SameSite=Lax`);
  headers.append('Set-Cookie', `oauth_token_endpoint=${encodeURIComponent(token_endpoint || '')}; HttpOnly; Secure; Path=/; SameSite=Lax`);
  headers.append('Content-Type', 'application/json');

  return new Response(JSON.stringify({ url: redirectUrl }), {
    status: 200,
    headers,
  });
}
