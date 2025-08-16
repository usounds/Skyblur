import { fetchWithDpop } from '@/logic/HandleXrpcProxy';
import { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { getSignedCookie } from "../logic/CookieHandler";

export const handle = async (c: Context): Promise<Response> => {
    // path 取得
    const fullPath = c.req.path // 例: "/xrpc/app.bsky.aaab.bbb"
    const endpoint = fullPath;

    // クッキー取得
    //const oauthKey = getCookie(c, 'oauth_key') || ''
    const cookieSecret = c.env.AUTH_SECRET
    const jwtSecret = c.env.JWT_SECRET
    const thisUrl = c.env.API_HOST

    // Cloudflare KV
    const myKv = c.env.SKYBLUR_OAUTH;


    // Cookie 検証
    const kvKeyVerified = await getSignedCookie(c, 'oauth_key', cookieSecret);
    if (!kvKeyVerified) return c.text('Invalid oauth_key', 401);

    // セッショントークン取得
    const tokenRaw = await myKv.get('session:' + kvKeyVerified);
    if (!tokenRaw) return c.text('Token not found', 401);

    try {
        // GET クエリ保持
        const url = new URL(c.req.url);
        const queryString = url.search;

        // POST ボディ処理
        let body: string | Blob | FormData | URLSearchParams | undefined;
        const contentType = c.req.header('content-type') || '';

        if (c.req.method === 'POST') {
            if (contentType.includes('application/json')) {
                const json = await c.req.json().catch(() => null);
                body = json ? JSON.stringify(json) : undefined;
            } else if (contentType.includes('multipart/form-data')) {
                body = await c.req.formData();
            } else if (contentType.includes('text/plain')) {
                const text = await c.req.text();
                body = new Blob([text], { type: 'text/plain' });
            } else {
                body = await c.req.blob();
            }
        }

        // DPoP 付きで Bluesky API にプロキシ
        const result = await fetchWithDpop(
            endpoint + queryString,
            { method: c.req.method as 'GET' | 'POST', body },
            kvKeyVerified,
            myKv,
            jwtSecret,
            cookieSecret,
            thisUrl,
            c,
            contentType,
        ) as Response


    // ステータスとヘッダーを保持して返す
    return new Response(JSON.stringify(result), {
        status: result.status,
    });
    } catch (e) {
        let payload: Record<string, unknown>;
        if (e instanceof Error) {
            try {
                payload = JSON.parse(e.message);
            } catch {
                payload = { message: e.message };
            }
        } else {
            payload = { message: String(e) };
        }
        return c.json(payload, 500);
    }

}