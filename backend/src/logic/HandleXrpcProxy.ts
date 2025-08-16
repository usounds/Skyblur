import { jwks, AuthorizationServerMetadata } from '@/logic/type';
import * as DPoP from 'dpop';
import type { JWTPayload } from "jose";
import * as jose from 'jose';
import { getSignedCookie } from 'hono/cookie';
import { Context } from 'hono';

export interface TokenData {
  access_token: string;
  token_type: string;
  refresh_token: string;
  scope: string;
  expires_in: number;
  sub: string;
}

export async function fetchAuthorizationServer(
  myKv: KVNamespace,
  endpoint: string
): Promise<AuthorizationServerMetadata> {
  let raw: string | null = await myKv.get(`oauth-authorization-server:${endpoint}`);
  if (!raw) {
    const res = await fetch(`${endpoint}/.well-known/oauth-authorization-server`);
    if (!res.ok) throw new Error("Failed to fetch oauth-authorization-server");
    raw = await res.text();

    let ttl: number | undefined;
    const cacheControl = res.headers.get("Cache-Control");
    if (cacheControl) {
      const match = cacheControl.match(/max-age=(\d+)/i);
      if (match) ttl = parseInt(match[1], 10);
    }

    await myKv.put(`oauth-authorization-server:${endpoint}`, raw, { expirationTtl: ttl });
  }

  return JSON.parse(raw) as AuthorizationServerMetadata;
}

interface FetchWithDpopOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?:
  | Record<string, unknown>
  | string
  | URLSearchParams
  | FormData
  | Blob;
  maxRetries?: number;
}

export async function fetchWithDpop<T = unknown>(
  url: string,
  options: FetchWithDpopOptions,
  oauthKey: string,
  myKv: KVNamespace,
  oauthSecret: string,
  cookieSecret: string,
  thisUrl: string,
  c:Context,
  contentType?: string
): Promise<T> {
  const kvKeyVerified = await getSignedCookie(c, oauthKey, cookieSecret);
  if (!kvKeyVerified) throw new Error("Invalid or missing oauth_key");

  const token = await myKv.get('session:' + kvKeyVerified);
  if (!token) throw new Error("Token not found in KV");

  const tokenData: TokenData = JSON.parse(token);
  const payload = jose.decodeJwt(tokenData.access_token) as JWTPayload;
  const accessToken = await getAccessToken(oauthKey, myKv,oauthSecret, cookieSecret, thisUrl, c);

  let urlGlobal = url;
  if (url.startsWith('/xrpc/') && typeof payload.aud === 'string') {
    urlGlobal = payload.aud.replace('did:web:', 'https://') + url;
  }

  const method = options.method || 'GET';
  let dpopNonce: string | undefined = await myKv.get(`dpopNonce:${kvKeyVerified}`) || undefined;
  const maxRetries = options.maxRetries ?? 2;

  const stored = await myKv.get(`dpopKey:${kvKeyVerified}`);
  if (!stored) throw new Error('DPoP key not found');
  const parsed = JSON.parse(stored);

  const restoredKeypair: DPoP.KeyPair = {
    privateKey: await jose.importJWK(parsed.privateKey, 'ES256', { extractable: true }) as CryptoKey,
    publicKey: await jose.importJWK(parsed.publicKey, 'ES256', { extractable: true }) as CryptoKey
  };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const startTime = Date.now();

    const proof = await DPoP.generateProof(restoredKeypair, urlGlobal, method, dpopNonce, accessToken);
    const headers: Record<string, string> = {
      'DPoP': proof,
      'Authorization': `DPoP ${accessToken}`,
    };


    let requestBody: string | FormData | Blob | undefined;

    if (!options.body) {
      requestBody = undefined;
    } else if (typeof options.body === 'string') {
      requestBody = options.body;
    } else if (options.body instanceof FormData) {
      requestBody = options.body;
    } else if (options.body instanceof Blob) {
      requestBody = options.body;
    } else if (options.body instanceof URLSearchParams) {
      requestBody = options.body.toString(); // application/x-www-form-urlencoded 用に文字列化
    } else {
      // Record<string, any> は JSON 文字列化
      requestBody = JSON.stringify(options.body);
    }

    headers['Content-Type'] =
      contentType || 'application/json';

    console.log(requestBody)

    const res = await fetch(urlGlobal, {
      method,
      headers,
      body: requestBody,
    });

    const elapsedMs = Date.now() - startTime;
    console.log(`${attempt}回目の処理時間: ${elapsedMs}ms`);

    // DPoP nonce 再取得
    if (res.status === 401 || res.status === 400) {
      const wwwAuth = res.headers.get('www-authenticate');
      if (wwwAuth?.includes('use_dpop_nonce')) {
        const nonce = res.headers.get('dpop-nonce');
        if (!nonce) throw new Error('DPoP nonce required but missing');
        dpopNonce = nonce;
        await myKv.put(`dpopNonce:${kvKeyVerified}`, dpopNonce, { expirationTtl: 300 });
        continue;
      }
    }

    const returnContentType = res.headers.get('content-type') || ''

    // JSON なら parse、それ以外は ArrayBuffer で返す
    let data: Record<string, unknown> | ArrayBuffer | T;

    if (returnContentType.includes("application/json")) {
      // JSON は text として読んでパース
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }

      return data as T; 
    } else {
      // JSON 以外はそのまま ArrayBuffer
      data = await res.arrayBuffer();
      return data as T
    }
  }

  throw new Error('Max retries exceeded');
}

export async function getAccessToken(oauthKey: string, myKv: KVNamespace, oauthSecret:string, cookieSecret:string, thisUrl : string,c:Context) {
  const privateJwk = { ...jwks.keys[0], d:oauthSecret };

  console.log(privateJwk)
  const kvKeyVerified = await getSignedCookie(c, oauthKey, cookieSecret);

  const lockKey = `lock:${oauthKey}`;
  let waited = 0;
  const existingLock = await myKv.get(lockKey);
  if (existingLock) {
    console.log('getAccessToken locked');
    while (await myKv.get(lockKey)) {
      if (waited >= 5) {
        console.warn('Lock exists, but forcing execution after 5 seconds');
        await myKv.delete(lockKey);
        break;
      }
      await new Promise(r => setTimeout(r, 1000));
      waited++;
    }
  }

  try {
    const raw = await myKv.get('session:' + kvKeyVerified);
    if (!raw) throw new Error('No session found');

    const tokenData = JSON.parse(raw) as TokenData;
    const payload = jose.decodeJwt(tokenData.access_token) as JWTPayload;
    if (!payload.exp) throw new Error("access_token has no exp");

    const now = Math.floor(Date.now() / 1000);
    const expiresIn = payload.exp - now;

    const client_id = `https://${thisUrl}/client-metadata.json`;
    const authorizationServerMetadata = await fetchAuthorizationServer(myKv, payload.iss || '');

    const clientAssertion = await new jose.SignJWT({
      sub: client_id,
      iss: client_id,
      aud: authorizationServerMetadata.issuer,
      jti: crypto.randomUUID(),
    })
      .setProtectedHeader({ alg: "ES256", typ: "JWT", kid: privateJwk.kid })
      .setIssuedAt(now)
      .setExpirationTime(now + 300)
      .sign(privateJwk);

    const stored = await myKv.get(`dpopKey:${kvKeyVerified}`);
    if (!stored) throw new Error('DPoP key not found');
    const parsed = JSON.parse(stored);

    const restoredKeypair: DPoP.KeyPair = {
      privateKey: await jose.importJWK(parsed.privateKey, 'ES256', { extractable: true }) as CryptoKey,
      publicKey: await jose.importJWK(parsed.publicKey, 'ES256', { extractable: true }) as CryptoKey
    };

    if (expiresIn < 300) {
      console.log('getAccessToken expired');
      await myKv.put(lockKey, '1', { expirationTtl: 60 });

      const bal = await myKv.get(`oauth-authorization-server:${payload.iss}`);
      const authorizationServerMetadata = JSON.parse(bal || '') as AuthorizationServerMetadata;

      async function refreshTokenRequest(dpopNonce?: string): Promise<TokenData> {
        const proof = await DPoP.generateProof(
          restoredKeypair,
          authorizationServerMetadata.token_endpoint,
          'POST',
          dpopNonce
        );

        const res = await fetch(authorizationServerMetadata.token_endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'DPoP': proof },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: tokenData.refresh_token,
            client_id: client_id,
            client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
            client_assertion: clientAssertion,
          }),
        });

        if (!res.ok) {
          const text = await res.clone().text();
          if (text.includes('use_dpop_nonce')) {
            const nonce = res.headers.get('DPoP-Nonce');
            if (!nonce) throw new Error('DPoP nonce required but missing');
            return refreshTokenRequest(nonce);
          } else {
            throw new Error(text);
          }
        }

        const newTokenData: TokenData = await res.json();
        await myKv.put("session:" + kvKeyVerified, JSON.stringify(newTokenData));
        return newTokenData;
      }

      const refreshedTokenData = await refreshTokenRequest();
      return refreshedTokenData.access_token;
    }

    return tokenData.access_token;
  } finally {
    await myKv.delete(lockKey);
  }
}
