import { fetchWithDpop, verifyCookie, TokenData } from "@/logic/HandleXrpcProxy";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { JWTPayload } from "jose";
import * as jose from 'jose';

export async function GET(request: Request) {
  // 現在のセッションのDIDを取得

  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [key, ...vals] = c.trim().split('=');
      return [key, decodeURIComponent(vals.join('='))];
    })
  );

  const oauthKey = cookies['oauth_key'];

  const myKv = getCloudflareContext().env.SKYBLUR_OAUTH;
  const kvKeyVerified = await verifyCookie(oauthKey);
  if (!kvKeyVerified) throw new Error("Invalid or missing oauth_key");

  const tokenRaw = await myKv.get('session:' + kvKeyVerified);
  if (!tokenRaw) throw new Error("Token not found");

  const tokenData: TokenData = JSON.parse(tokenRaw);
  const payload = jose.decodeJwt(tokenData.access_token) as JWTPayload;

  try {

    const result = await fetchWithDpop(
      `/xrpc/app.bsky.actor.getProfile?${new URLSearchParams({ actor: payload.sub || '' })}`,
      { method: 'GET' },
      oauthKey
    );

    return new Response(JSON.stringify(result), {
      status: 200
    });
  } catch (e) {
    type ErrorPayload = { message: string } | Record<string, unknown>;

    let payload: ErrorPayload;

    if (e instanceof Error) {
      try {
        // e.message が JSON ならパースしてそのまま返す
        payload = JSON.parse(e.message) as Record<string, unknown>;
      } catch {
        // JSON でなければ文字列として返す
        payload = { message: e.message };
      }
    } else {
      payload = { message: String(e) };
    }
    return new Response(JSON.stringify(payload), { status: 500 });
  }

}

