import { getOAuthClient, getRequestOrigin } from "@/logic/ATPOauth";
import { handle as decryptByCidHandle } from "@/api/decryptByCid"
import { handle as getDidDoc } from "@/api/DidDocCache"
import { handle as ecnryptHandle } from "@/api/ecnrypt"
import { handle as getPostHandler } from "@/api/getPost"
import { handle as resolveHandle } from "@/api/resolveHandle"
import { handle as uploadBlobHandle } from "@/api/uploadBlob"
import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { DurableObject } from "cloudflare:workers";
import { Client } from "@atcute/client";
import type { OAuthSession } from "@atcute/oauth-node-client";

// 1. DOクラスの定義
export class OAuthStoreDO extends DurableObject {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    const key = url.searchParams.get("key");

    if (!key) {
      return new Response("Missing key", { status: 400 });
    }

    console.log(`[DO] ${request.method} key=${key}`);

    if (request.method === "GET") {
      const val = await this.ctx.storage.get(key);
      console.log(`[DO] GET result for ${key}:`, val ? "Found" : "Not Found");
      if (val === undefined) {
        return new Response(null, { status: 404 });
      }
      return new Response(JSON.stringify(val), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (request.method === "PUT") {
      const val = await request.json();
      console.log(`[DO] PUT ${key}`);
      await this.ctx.storage.put(key, val);
      return new Response("OK");
    }

    if (request.method === "DELETE") {
      console.log(`[DO] DELETE ${key}`);
      await this.ctx.storage.delete(key);
      return new Response("OK");
    }

    return new Response("Method not allowed", { status: 405 });
  }
}


// 型定義
export interface Env {
  SKYBLUR_DO: DurableObjectNamespace<OAuthStoreDO>;
  SKYBLUR_KV_CACHE: KVNamespace;
  APPVIEW_HOST?: string;
  OAUTH_PRIVATE_KEY_JWK?: string;
  DATA_ENCRYPTION_KEY?: string;
  API_HOST?: string;
}

const app = new Hono<{ Bindings: Env }>()



const allowedOrigins = [
  'https://dev.skyblur.uk',
  'https://skyblur.uk',
  'https://preview.skyblur.uk'
];

app.use('*', cors({
  origin: (origin, c) => {
    const allowedOrigins = [
      'https://dev.skyblur.uk',
      'https://skyblur.uk',
      'https://preview.skyblur.uk',
    ];

    // 許可されたオリジンまたは *.skyblur.uk サブドメインのみ許可
    if (allowedOrigins.includes(origin) || (origin && origin.match(/^https:\/\/[^\/]*\.skyblur\.uk$/))) {
      return origin;
    }

    // 不正なオリジンは拒否
    return null;
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'DPoP', 'atproto-proxy', 'x-atproto-allow-proxy'],
}))

// --- CSRF Protection Middleware ---
app.use('*', async (c, next) => {
  // GET, HEAD, OPTIONS は CSRF 保護不要
  if (c.req.method === 'GET' || c.req.method === 'HEAD' || c.req.method === 'OPTIONS') {
    return next();
  }

  const path = new URL(c.req.url).pathname;

  // 読み取り専用の Skyblur エンドポイントは CSRF 保護不要
  const readOnlyPaths = [
    '/xrpc/uk.skyblur.post.ecnrypt',
    '/xrpc/uk.skyblur.post.encrypt',
    '/xrpc/uk.skyblur.post.decryptByCid',
    '/xrpc/uk.skyblur.post.getPost',
    '/xrpc/uk.skyblur.admin.getDidDocument',
    '/xrpc/uk.skyblur.admin.resolveHandle',
  ];

  if (readOnlyPaths.includes(path)) {
    return next();
  }

  const origin = c.req.header('origin');
  const referer = c.req.header('referer');

  const allowedOrigins = [
    'https://dev.skyblur.uk',
    'https://skyblur.uk',
    'https://preview.skyblur.uk',
  ];

  // Origin ヘッダーの検証
  const isValidOrigin = origin && (
    allowedOrigins.includes(origin) ||
    /^https:\/\/[^\/]*\.skyblur\.uk$/.test(origin)
  );

  // Referer ヘッダーの検証（Origin がない場合のフォールバック）
  const isValidReferer = referer && (
    allowedOrigins.some(o => referer.startsWith(o)) ||
    /^https:\/\/[^\/]*\.skyblur\.uk\//.test(referer)
  );

  // Origin または Referer のいずれかが有効であれば許可
  if (!isValidOrigin && !isValidReferer) {
    console.warn(`CSRF protection: Rejected request from origin=${origin}, referer=${referer}`);
    return c.json({ error: 'Invalid origin or referer' }, 403);
  }

  return next();
  return next();
});

// --- OAuth Helpers ---

async function signDid(did: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(did)
  );

  // Base64Url conversion
  const b64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${did}.${b64}`;
}

// --- Session Helpers ---

async function withSession(
  c: Context<{ Bindings: Env }>,
  did: string,
  callback: (session: OAuthSession) => Promise<Response>
): Promise<Response> {
  const origin = getRequestOrigin(c.req.raw, c.env);
  const oauth = await getOAuthClient(c.env, origin);
  const { restoreSession, clearSessionCache } = await import('@/logic/ATPOauth');

  try {
    const session = await restoreSession(oauth, did);
    return await callback(session);
  } catch (e: any) {
    // リフレッシュエラー時は、ローカルキャッシュをクリアして最大1回リトライする
    if (e?.name === 'TokenRefreshError' || e?.message?.includes('session was deleted')) {
      console.warn(`[OAuth] TokenRefreshError for ${did}, retrying...`);
      clearSessionCache(did);
      try {
        const session = await restoreSession(oauth, did);
        return await callback(session);
      } catch (retryError) {
        throw retryError;
      }
    }
    throw e;
  }
}

// --- OAuth エンドポイント ---

// 1. クライアントメタデータ (軽量版: getOAuthClient を呼ばない)
app.get('/oauth/client-metadata.json', async (c) => {
  const origin = getRequestOrigin(c.req.raw, c.env);
  const { scopeList } = await import('@/logic/ATPOauth');

  const metadata = {
    client_id: `${origin}/oauth/client-metadata.json`,
    client_name: 'Skyblur',
    client_uri: origin,
    redirect_uris: [`${origin}/oauth/callback`],
    jwks_uri: `${origin}/oauth/jwks.json`,
    scope: scopeList,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'private_key_jwt',
    token_endpoint_auth_signing_alg: 'ES256',
    dpop_bound_access_tokens: true,
  };

  return c.json(metadata, 200, {
    'Cache-Control': 'public, max-age=3600, s-maxage=86400',
  });
});

// 2. JWKS (軽量版: JWK パースのみ)
app.get('/oauth/jwks.json', (c) => {
  const privateKeyRaw = c.env.OAUTH_PRIVATE_KEY_JWK;
  if (!privateKeyRaw) {
    return c.json({ error: 'OAUTH_PRIVATE_KEY_JWK is not set' }, 500);
  }

  const privateKey = JSON.parse(privateKeyRaw);
  const { d, ...publicKey } = privateKey;
  if (!publicKey.kid) publicKey.kid = 'k1';
  if (!publicKey.alg) publicKey.alg = 'ES256';

  return c.json({ keys: [publicKey] }, 200, {
    'Cache-Control': 'public, max-age=3600, s-maxage=86400',
  });
});

// 2.5 DID Document
app.get('/api/did-document', async (c) => {
  const host = c.req.query('host') || c.env.APPVIEW_HOST || 'skyblur.uk';
  const apiOrigin = getRequestOrigin(c.req.raw, c.env);
  const apiHost = new URL(apiOrigin).host;

  const didDocument = {
    "@context": [
      "https://www.w3.org/ns/did/v1"
    ],
    "id": `did:web:${host}`,
    "service": [
      {
        "id": "#skyblur_appview",
        "type": "AtprotoAppView",
        "serviceEndpoint": `https://${c.env.APPVIEW_HOST || host}`
      },
      {
        "id": "#skyblur_api",
        "type": "SkyblurAPI",
        "serviceEndpoint": `https://${apiHost}`
      }
    ]
  };
  return c.json(didDocument);
});

// 3. ログイン開始
app.get('/oauth/login', async (c) => {
  const handle = c.req.query('handle');

  const origin = getRequestOrigin(c.req.raw, c.env);
  const client = await getOAuthClient(c.env, origin);

  try {
    const authorizeTarget = handle
      ? { type: 'account' as const, identifier: handle as `${string}.${string}` }
      : { type: 'pds' as const, serviceUrl: 'https://bsky.social' };

    const { url } = await client.authorize({
      target: authorizeTarget,
      state: { timestamp: Date.now() },
    });

    // 許可されたオリジンの一覧（ドメイン検証用）
    const allowedPatterns = [
      '^https://dev\\.skyblur\\.uk$',
      '^https://skyblur\\.uk$',
      '^https://[^/]*\\.skyblur\\.uk$'
    ];

    const isAllowedOrigin = (urlStr: string) => {
      try {
        const u = new URL(urlStr);
        const origin = u.origin;
        return allowedPatterns.some(pattern => new RegExp(pattern).test(origin));
      } catch {
        return false;
      }
    };

    // redirect_uri クエリパラメータを優先、なければ Referer ヘッダーを使用
    const redirectUriParam = c.req.query('redirect_uri');
    const referer = c.req.header('referer');
    let callbackUrl = '/console';

    if (redirectUriParam && isAllowedOrigin(redirectUriParam)) {
      // 絶対URLとして許可されている場合、そのまま保持
      const url = new URL(redirectUriParam);
      url.searchParams.delete('loginError');
      callbackUrl = url.toString();
    } else if (referer && isAllowedOrigin(referer)) {
      // Refererが許可されている場合、絶対URLとして保持
      const url = new URL(referer);
      url.searchParams.delete('loginError');
      callbackUrl = url.toString();
    } else if (redirectUriParam) {
      // 相対パスまたは許可されていないドメインの場合のフォールバック
      try {
        const redirectUrl = new URL(redirectUriParam, origin);
        redirectUrl.searchParams.delete('loginError');
        if (redirectUrl.pathname !== '/') {
          callbackUrl = redirectUrl.pathname + redirectUrl.search;
        }
      } catch { }
    } else if (referer) {
      // Refererのフォールバック
      try {
        const refUrl = new URL(referer);
        refUrl.searchParams.delete('loginError');
        if (refUrl.pathname !== '/') {
          callbackUrl = refUrl.pathname + refUrl.search;
        }
      } catch { }
    }

    const domain = c.env.APPVIEW_HOST ? `.${c.env.APPVIEW_HOST.split('.').slice(-2).join('.')}` : undefined;

    setCookie(c, 'oauth_callback', callbackUrl, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 3600,
      domain: domain,
    });

    return c.redirect(url.toString());
  } catch (e) {
    console.error('OAuth Login Error:', e);

    // エラー時の戻り先を特定する（referer または redirect_uri パラメータからオリジンを抽出）
    const redirectUriParam = c.req.query('redirect_uri');
    const referer = c.req.header('referer');
    let targetOrigin = '';

    try {
      if (redirectUriParam) {
        targetOrigin = new URL(redirectUriParam).origin;
      } else if (referer) {
        targetOrigin = new URL(referer).origin;
      }
    } catch { }

    if (!targetOrigin) {
      targetOrigin = c.env.APPVIEW_HOST ? `https://${c.env.APPVIEW_HOST}` : 'https://skyblur.uk';
    }

    return c.redirect(`${targetOrigin}/?loginError=invalid_handle`);
  }
});

// 4. コールバック
app.get('/oauth/callback', async (c) => {
  const origin = getRequestOrigin(c.req.raw, c.env);
  const client = await getOAuthClient(c.env, origin);
  const url = new URL(c.req.url);

  try {
    const { session } = await client.callback(url.searchParams);

    const secret = c.env.OAUTH_PRIVATE_KEY_JWK || 'default-fallback';
    const signedDid = await signDid(session.did, secret);

    const callbackCookie = getCookie(c, 'oauth_callback');
    const redirectTo = callbackCookie ? decodeURIComponent(callbackCookie) : '/';

    // redirectTo が絶対URL（httpで始まるなど）の場合はそのまま使い、
    // 相対パスの場合は APPVIEW_HOST または skyblur.uk をベースとする
    let finalRedirect: string;
    if (redirectTo.startsWith('http')) {
      finalRedirect = redirectTo;
    } else {
      const appViewUrl = c.env.APPVIEW_HOST ? `https://${c.env.APPVIEW_HOST}` : 'https://skyblur.uk';
      finalRedirect = `${appViewUrl}${redirectTo}`;
    }

    const domain = c.env.APPVIEW_HOST ? `.${c.env.APPVIEW_HOST.split('.').slice(-2).join('.')}` : undefined;
    const isSecure = origin.startsWith('https');

    setCookie(c, 'oauth_did', signedDid, {
      path: '/',
      httpOnly: true,
      secure: isSecure,
      sameSite: 'Lax',
      maxAge: 30 * 24 * 60 * 60,
      domain: domain,
    });

    deleteCookie(c, 'oauth_callback', { path: '/', domain: domain });

    return c.redirect(finalRedirect);
  } catch (e: any) {
    console.error('OAuth Callback Error:', e);

    // ユーザーが拒否した場合などは、エラーを表示せずアプリに戻す
    const isRejected = e?.name === 'OAuthCallbackError' && (e?.message?.includes('rejected') || e?.message?.includes('denied'));

    const callbackCookie = getCookie(c, 'oauth_callback');
    const redirectTo = callbackCookie ? decodeURIComponent(callbackCookie) : '/';
    const domain = c.env.APPVIEW_HOST ? `.${c.env.APPVIEW_HOST.split('.').slice(-2).join('.')}` : undefined;

    // エラー時もクッキーは掃除する
    deleteCookie(c, 'oauth_callback', { path: '/', domain: domain });

    if (isRejected) {
      // 拒否された場合は loginError パラメータを付けて戻す
      let finalRedirect: string;
      if (redirectTo.startsWith('http')) {
        finalRedirect = redirectTo;
      } else {
        const appViewUrl = c.env.APPVIEW_HOST ? `https://${c.env.APPVIEW_HOST}` : 'https://skyblur.uk';
        finalRedirect = `${appViewUrl}${redirectTo}`;
      }

      const separator = finalRedirect.includes('?') ? '&' : '?';
      return c.redirect(`${finalRedirect}${separator}loginError=rejected`);
    }

    if (e instanceof Error) {
      console.error(e.stack);
    }
    return c.text(`OAuth callback failed: ${String(e)}`, 400);
  }
});

// 5. セッション確認
app.get('/oauth/session', async (c) => {
  const rawDid = getCookie(c, 'oauth_did');
  const secret = c.env.OAUTH_PRIVATE_KEY_JWK || 'default-fallback';

  if (!rawDid) return c.json({ authenticated: false });

  try {
    // 署名検証 (DIDs containing dots like did:web are supported)
    const lastDotIndex = rawDid.lastIndexOf('.');
    if (lastDotIndex === -1) {
      console.warn(`[OAuth] /oauth/session invalid token format (no dots)`);
      return c.json({ authenticated: false });
    }

    const did = rawDid.substring(0, lastDotIndex);
    const signature = rawDid.substring(lastDotIndex + 1);

    const expectedSigned = await signDid(did, secret);
    if (rawDid !== expectedSigned) {
      return c.json({ authenticated: false });
    }

    try {
      return await withSession(c, did, async (session) => {
        // PDS の特定
        let resolvedPds = (session as any).pds ||
          (session as any).server?.serverMetadata?.issuer ||
          (session as any).info?.pds ||
          (session as any).info?.identity?.pds?.[0] ||
          (session as any).info?.identity?.services?.atproto_pds?.[0] ||
          (session as any).info?.server ||
          '';

        if (!resolvedPds) {
          const cacheKey = `diddoc_${did}`;
          try {
            const doNamespace = c.env.SKYBLUR_DO;
            const doId = doNamespace.idFromName('global_cache');
            const stub = doNamespace.get(doId);

            let didDoc: any = null;
            const cacheRes = await stub.fetch(new Request(`http://do/cache?key=${encodeURIComponent(cacheKey)}`));
            if (cacheRes.ok) {
              didDoc = await cacheRes.json();
            }

            if (!didDoc && did.startsWith('did:plc:')) {
              const res = await fetch(`https://plc.directory/${encodeURIComponent(did)}`);
              if (res.ok) {
                didDoc = await res.json();
                c.executionCtx.waitUntil(
                  stub.fetch(new Request(`http://do/cache?key=${encodeURIComponent(cacheKey)}`, {
                    method: 'PUT',
                    body: JSON.stringify(didDoc)
                  }))
                );
              }
            }

            if (didDoc) {
              const service = didDoc.service?.find((s: any) => s.type === 'AtprotoPersonalDataServer');
              if (service) resolvedPds = service.serviceEndpoint;
            }
          } catch (e) {
            console.error('Failed to resolve PDS from cache/directory:', e);
          }
        }

        const client = new Client({ handler: session });
        let userProf: any = null;
        try {
          const profileRes = await (client as any).get('app.bsky.actor.getProfile', {
            params: { actor: session.did },
          });
          if (profileRes.ok) userProf = profileRes.data;
        } catch (err) {
          console.error('Failed to fetch profile during session check:', err);
        }

        const scope = await session.getTokenInfo();
        return c.json({
          authenticated: true,
          did: session.did,
          pds: scope.aud,
          userProf,
          scope: scope.scope,
        });
      });
    } catch (e: any) {
      if (e?.name === 'TokenRefreshError' || e?.message?.includes('session was deleted')) {
        return c.json({ authenticated: false });
      }
      console.error('Session Restore Error:', e);
      return c.json({ authenticated: false });
    }
  } catch (e: any) {
    console.error('Unexpected error in /oauth/session:', e);
    return c.json({ authenticated: false });
  }
});

// --- API エンドポイント ---

app.post('/xrpc/uk.skyblur.post.encrypt', (c) => {
  return ecnryptHandle(c)
})

// 6. ログアウト
app.post('/oauth/logout', async (c) => {
  const rawDid = getCookie(c, 'oauth_did');
  const secret = c.env.OAUTH_PRIVATE_KEY_JWK || 'default-fallback';

  if (rawDid) {
    const lastDotIndex = rawDid.lastIndexOf('.');
    if (lastDotIndex !== -1) {
      const did = rawDid.substring(0, lastDotIndex);
      const expectedSigned = await signDid(did, secret);

      if (rawDid === expectedSigned) {
        try {
          const origin = getRequestOrigin(c.req.raw, c.env);
          const oauth = await getOAuthClient(c.env, origin);

          // OAuth セッションを取り消す
          await oauth.revoke(did as any);

          // セッションキャッシュをクリア
          const { clearSessionCache } = await import('@/logic/ATPOauth');
          clearSessionCache(did);
        } catch (err) {
          console.error('OAuth revoke error:', err);
          // エラーでも続行してクッキーは削除する
        }
      }
    }
  }

  const domain = c.env.APPVIEW_HOST ? `.${c.env.APPVIEW_HOST.split('.').slice(-2).join('.')}` : undefined;
  const origin = getRequestOrigin(c.req.raw, c.env);
  const isSecure = origin.startsWith('https');

  // oauth_did クッキーを削除
  setCookie(c, 'oauth_did', '', {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'Lax',
    path: '/',
    maxAge: 0,
    domain: domain,
  });

  return c.json({ success: true });
});

app.post('/xrpc/uk.skyblur.post.decryptByCid', (c) => {
  return decryptByCidHandle(c)
})

app.post('/xrpc/uk.skyblur.post.getPost', (c) => {
  return getPostHandler(c)
})

app.get('/xrpc/uk.skyblur.admin.getDidDocument', (c) => {
  const origin = c.req.header('origin') || '';
  if (!allowedOrigins.includes(origin)) {
    return c.json({ error: 'This method shoud be call from Skyblur AppView' }, 403);
  }

  return getDidDoc(c)
})

app.get('/xrpc/uk.skyblur.admin.resolveHandle', (c) => {
  return resolveHandle(c)
})

app.post('/xrpc/com.atproto.repo.uploadBlob', async (c) => {
  const rawDid = getCookie(c, 'oauth_did');
  const secret = c.env.OAUTH_PRIVATE_KEY_JWK || 'default-fallback';
  if (!rawDid) return c.json({ error: 'Authentication required' }, 401);

  const lastDotIndex = rawDid.lastIndexOf('.');
  if (lastDotIndex === -1) return c.json({ error: 'Authentication required' }, 401);

  const did = rawDid.substring(0, lastDotIndex);

  const expectedSigned = await signDid(did, secret);
  if (rawDid !== expectedSigned) return c.json({ error: 'Authentication required' }, 401);

  try {
    return await withSession(c, did, async (session) => {
      const client = new Client({ handler: session });
      return uploadBlobHandle(c, client);
    });
  } catch (e) {
    console.error('UploadBlob Error:', e);
    return c.json({ error: String(e) }, 500);
  }
})

// --- Catch-all XRPC Proxy ---
// 明示的に定義されていない全ての XRPC リクエストを PDS へプロキシする
app.all('/xrpc/:method{.*}', async (c) => {
  const method = c.req.param('method');

  // セッションを確認
  const rawDid = getCookie(c, 'oauth_did');
  const secret = c.env.OAUTH_PRIVATE_KEY_JWK || 'default-fallback';

  if (!rawDid) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  // 署名検証
  const lastDotIndex = rawDid.lastIndexOf('.');
  if (lastDotIndex === -1) return c.json({ error: 'Authentication required' }, 401);

  const did = rawDid.substring(0, lastDotIndex);
  const expectedSigned = await signDid(did, secret);
  if (rawDid !== expectedSigned) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    return await withSession(c, did, async (session) => {
      const requestMethod = c.req.method.toUpperCase();
      const client = new Client({ handler: session });

      if (requestMethod === 'POST') {
        const contentType = c.req.header('content-type') || 'application/json';
        let requestData: any;

        if (contentType.includes('application/json')) {
          requestData = await c.req.json();
        } else {
          requestData = new Uint8Array(await c.req.arrayBuffer());
        }

        const response = await (client as any).post(method, {
          input: requestData,
          data: requestData,
          encoding: contentType,
        });
        return c.json(response.data, response.ok ? 200 : 400);
      } else {
        const response = await (client as any).get(method, {
          params: c.req.query(),
        });
        return c.json(response.data, response.ok ? 200 : 400);
      }
    });
  } catch (e) {
    console.error(`XRPC Proxy Error [${method}] for ${did}:`, e);
    return c.json({ error: String(e) }, 500);
  }
});

app.get('/', (c) => {
  const returnDocument = {
    "message": "This is Skyblur API Service. AppView is available at https://skyblur.uk/"
  };
  return c.json(returnDocument)
})


export default app
