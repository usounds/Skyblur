import { getOAuthClient, getRequestOrigin } from "@/logic/ATPOauth";
import { handle as decryptByCidHandle } from "@/api/decryptByCid"
import { handle as getDidDoc } from "@/api/DidDocCache"
import { handle as ecnryptHandle } from "@/api/ecnrypt"
import { handle as getPostHandler } from "@/api/getPost"
import { handle as resolveHandle } from "@/api/resolveHandle"
import { handle as uploadBlobHandle } from "@/api/uploadBlob"
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { DurableObject } from "cloudflare:workers";
import { Client } from "@atcute/client";

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

    if (request.method === "GET") {
      const val = await this.ctx.storage.get(key);
      if (val === undefined) {
        return new Response(null, { status: 404 });
      }
      return new Response(JSON.stringify(val), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (request.method === "PUT") {
      const val = await request.json();
      await this.ctx.storage.put(key, val);
      return new Response("OK");
    }

    if (request.method === "DELETE") {
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

// --- OAuth エンドポイント ---

// 1. クライアントメタデータ
app.get('/api/client-metadata.json', async (c) => {
  const origin = getRequestOrigin(c.req.raw, c.env);
  const client = await getOAuthClient(c.env, origin);
  return c.json(client.metadata);
});

// 2. JWKS
app.get('/api/jwks.json', async (c) => {
  try {
    const privateKeyRaw = c.env.OAUTH_PRIVATE_KEY_JWK;
    if (!privateKeyRaw) {
      throw new Error('OAUTH_PRIVATE_KEY_JWK is not set');
    }

    const privateKey = JSON.parse(privateKeyRaw);

    // 秘密鍵 D 以外を抽出して公開鍵 JWK を作成
    const { d, ...publicKey } = privateKey;

    // kid がない場合はデフォルトを付与
    if (!publicKey.kid) publicKey.kid = 'k1';
    if (!publicKey.alg) publicKey.alg = 'ES256';

    return c.json({
      keys: [publicKey]
    });
  } catch (e) {
    console.error('JWKS Error:', e);
    return c.json({ error: 'Internal Server Error', detail: String(e) }, 500);
  }
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
  if (!handle) return c.text('Handle is required', 400);

  const origin = getRequestOrigin(c.req.raw, c.env);
  const client = await getOAuthClient(c.env, origin);

  try {
    const { url } = await client.authorize({
      target: { type: 'account', identifier: handle as any },
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
    return c.redirect(`/?loginError=1`);
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

    setCookie(c, 'oauth_did', signedDid, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 30 * 24 * 60 * 60,
      domain: domain,
    });

    deleteCookie(c, 'oauth_callback', { path: '/', domain: domain });

    return c.redirect(finalRedirect);
  } catch (e) {
    console.error('OAuth Callback Error:', e);
    return c.text('OAuth callback failed', 400);
  }
});

// 5. セッション確認
app.get('/oauth/session', async (c) => {
  const rawDid = getCookie(c, 'oauth_did');
  const secret = c.env.OAUTH_PRIVATE_KEY_JWK || 'default-fallback';

  if (!rawDid) return c.json({ authenticated: false });

  // 署名検証 (signDid の逆回転)
  const parts = rawDid.split('.');
  if (parts.length !== 2) return c.json({ authenticated: false });

  const [did, signature] = parts;
  const expectedSigned = await signDid(did, secret);
  if (rawDid !== expectedSigned) {
    return c.json({ authenticated: false });
  }

  try {
    const origin = getRequestOrigin(c.req.raw, c.env);
    const oauth = await getOAuthClient(c.env, origin);
    const { restoreSession } = await import('@/logic/ATPOauth');
    const session = await restoreSession(oauth, did);

    // デバッグログから判明した構造 (session.server.serverMetadata.issuer) を含めて PDS を抽出
    let resolvedPds = (session as any).pds ||
      (session as any).server?.serverMetadata?.issuer ||
      (session as any).info?.pds ||
      (session as any).info?.identity?.pds?.[0] ||
      (session as any).info?.identity?.services?.atproto_pds?.[0] ||
      (session as any).info?.server ||
      '';

    // もし PDS が見つからない場合、キャッシュまたは DID から直接解決を試みる
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

        if (!didDoc) {

          if (did.startsWith('did:plc:')) {
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
        }

        if (didDoc) {
          const service = didDoc.service?.find((s: any) => s.type === 'AtprotoPersonalDataServer');
          if (service) {
            resolvedPds = service.serviceEndpoint;

          }
        }
      } catch (e) {
        console.error('Failed to resolve PDS from cache/directory:', e);
      }
    }

    return c.json({
      authenticated: true,
      did: session.did || (session as any).sub,
      pds: resolvedPds,
    });
  } catch (e: any) {
    // ログアウト後のセッション復元エラーは静かに処理
    if (e?.name === 'TokenRefreshError' || e?.message?.includes('session was deleted')) {
      return c.json({ authenticated: false });
    }
    // その他のエラーはログに記録
    console.error('Session Restore Error:', e);
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
    const parts = rawDid.split('.');
    if (parts.length === 2) {
      const [did] = parts;
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

  // oauth_did クッキーを削除
  setCookie(c, 'oauth_did', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 0,
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
  const parts = rawDid.split('.');
  if (parts.length !== 2) return c.json({ error: 'Authentication required' }, 401);
  const [did] = parts;
  const expectedSigned = await signDid(did, secret);
  if (rawDid !== expectedSigned) return c.json({ error: 'Authentication required' }, 401);

  const origin = getRequestOrigin(c.req.raw, c.env);
  const oauth = await getOAuthClient(c.env, origin);
  const session = await (await import('@/logic/ATPOauth')).restoreSession(oauth, did);
  const client = new Client({ handler: session });
  return uploadBlobHandle(c, client);
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
  const parts = rawDid.split('.');
  if (parts.length !== 2) return c.json({ error: 'Authentication required' }, 401);
  const [did, signature] = parts;
  const expectedSigned = await signDid(did, secret);
  if (rawDid !== expectedSigned) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const origin = getRequestOrigin(c.req.raw, c.env);
    const oauth = await getOAuthClient(c.env, origin);

    const { restoreSession } = await import('@/logic/ATPOauth');
    const session = await restoreSession(oauth, did);

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
