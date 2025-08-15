import { verifyCookie } from "@/logic/HandleXrpcProxy";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function GET(request: Request) {
    const env = getCloudflareContext().env;
    const myKv = env.SKYBLUR_OAUTH;

    // クッキーから oauth_key を取得
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = Object.fromEntries(
        cookieHeader.split(';').map(c => {
            const [key, ...vals] = c.trim().split('=');
            return [key, decodeURIComponent(vals.join('='))];
        })
    );
    const oauthKey = cookies['oauth_key'];
      const kvKeyVerified = await verifyCookie(oauthKey);

    if (kvKeyVerified) {
        // KV からセッション削除
        await myKv.delete(`session:${kvKeyVerified}`);
        await myKv.delete(`dpopKey:${kvKeyVerified}`);
        await myKv.delete(`dpopNonce:${kvKeyVerified}`);
    }

    // クッキー削除
    const headers = new Headers();
    headers.append('Set-Cookie', `oauth_key=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`);

    return new Response(JSON.stringify({ message: "Logged out" }), {
        status: 200,
        headers,
    });
}
