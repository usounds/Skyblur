import { Context } from 'hono';
import { fetchWithDpop, TokenData } from '@/logic/HandleXrpcProxy';
import type { JWTPayload } from "jose";
import * as jose from 'jose';
import { getSignedCookie } from "../logic/CookieHandler";

export const handle = async (c: Context): Promise<Response> => {
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

    console.log(kvKeyVerified)

    // セッショントークン取得
    const tokenRaw = await myKv.get('session:' + kvKeyVerified);
    if (!tokenRaw) return c.text('Token not found', 401);

    const tokenData: TokenData = JSON.parse(tokenRaw);
    const payload = jose.decodeJwt(tokenData.access_token) as JWTPayload;

    // fetchWithDpop の結果を unknown から Response にキャスト
    const rawResponse = await fetchWithDpop(
        `/xrpc/app.bsky.actor.getProfile?${new URLSearchParams({ actor: payload.sub || '' })}`,
        { method: 'GET' },
        kvKeyVerified,
        myKv,
        jwtSecret,
        cookieSecret,
        thisUrl,
        c
    ) as Response; // ここで Response 型にアサート

    // body を JSON として読む
    const data = rawResponse

    // ステータスとヘッダーを保持して返す
    return new Response(JSON.stringify(data), {
        status: rawResponse.status,
    });

}
