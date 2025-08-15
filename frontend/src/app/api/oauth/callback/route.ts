import * as jose from 'jose';
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { jwks } from '@/types/ClientMetadataContext'
import * as DPoP from 'dpop'


interface TokenData {
    access_token: string;
    token_type: string;
    refresh_token: string;
    scope: string;
    expires_in: number;
    sub: string;
}

export async function GET(request: Request) {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    const errorHeader = new Headers({
        Location: `https://${getCloudflareContext().env.APP_VIEW_URL}`,
    });

    if (!code || !state) {
        return new Response(null, {
            status: 302,
            headers: errorHeader
        });
    }

    // --- クッキーから code_verifier を取得 ---
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = Object.fromEntries(
        cookieHeader.split(';').map(c => {
            const [key, ...vals] = c.trim().split('=');
            return [key, decodeURIComponent(vals.join('='))];
        })
    );

    const codeVerifier = cookies['oauth_code_verifier'];
    const issuer = cookies['oauth_issuer'];
    const tokenEndpoint = cookies['oauth_token_endpoint'];

    if (!codeVerifier) {
        return new Response(null, {
            status: 302,
            headers: errorHeader
        });
    }
    if (!issuer) {
        return new Response(null, {
            status: 302,
            headers: errorHeader
        });
    }
    const client_id = `https://${getCloudflareContext().env.APP_VIEW_URL}/api/client-metadata.json`

    const d = getCloudflareContext().env.JWT_SECRET;
    const privateJwk = {
        ...jwks.keys[0],
        d, // ここで秘密鍵を追加
    };

    // --- client_assertion (private_key_jwt) を生成 ---
    const key = await jose.importJWK(privateJwk, "ES256");
    const now = Math.floor(Date.now() / 1000);
    const clientAssertion = await new jose.SignJWT({
        sub: client_id,
        iss: client_id,
        aud: issuer,
        jti: crypto.randomUUID(),
    })
        .setProtectedHeader({ alg: "ES256", typ: "JWT", kid: privateJwk.kid })
        .setIssuedAt(now)
        .setExpirationTime(now + 300)
        .sign(key);

    // --- DPoP proof 用キー生成 ---
    const keypair = await DPoP.generateKeyPair('ES256', { extractable: true })

    // --- トークンリクエスト関数（DPoP nonce 対応） ---
    async function requestToken(dpopNonce?: string): Promise<Response> {
        const proof = await DPoP.generateProof(keypair, tokenEndpoint, 'POST', dpopNonce)

        const res = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'DPoP': proof,
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code!,
                redirect_uri: `https://${getCloudflareContext().env.APP_VIEW_URL}/api/oauth/callback`,
                client_id: client_id,
                code_verifier: codeVerifier,
                client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
                client_assertion: clientAssertion,
            }),
        });

        if (!res.ok) {
            const text = await res.clone().text(); // clone して body を読む
            if (text.includes('use_dpop_nonce')) {
                const nonce = res.headers.get('DPoP-Nonce');
                if (!nonce) throw new Error('DPoP nonce required but missing');
                return requestToken(nonce); // 再リクエスト
            }
        }

        return res;
    }

    const tokenRes = await requestToken();

    if (!tokenRes.ok) {
        const text = await tokenRes.text(); // エラーボディを読み取る
        return new Response(`Token request failed: ${text}`, { status: 500 });
    }

    const tokenData = await tokenRes.json() as TokenData
    const kvKey = crypto.randomUUID();
    const myKv = getCloudflareContext().env.SKYBLUR_OAUTH;

    //アクセストークン保存
    await myKv.put(
        'session:' + kvKey,
        JSON.stringify(tokenData)
    );

    //鍵保存
    const privateSignedJwk = await jose.exportJWK(keypair.privateKey);
    const publicSignedJwk = await jose.exportJWK(keypair.publicKey);
    await myKv.put(`dpopKey:${kvKey}`, JSON.stringify({
        privateKey: privateSignedJwk,
        publicKey: publicSignedJwk,
    }));

    // AUTH_SECRET 取得
    const secret = getCloudflareContext().env.AUTH_SECRET;

    // HMAC 署名関数
    function signValue(value: string, secret: string) {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secret);
        return crypto.subtle.importKey(
            "raw",
            keyData,
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign", "verify"]
        ).then(key =>
            crypto.subtle.sign("HMAC", key, encoder.encode(value))
        ).then(sig => {
            // Base64URL エンコード
            return btoa(String.fromCharCode(...new Uint8Array(sig)))
                .replace(/\+/g, "-")
                .replace(/\//g, "_")
                .replace(/=+$/, "");
        });
    }

    // クッキー用に署名
    const signedKey = await signValue(kvKey, secret);


    // --- クッキー削除 & 必要であればアクセストークン保存 ---
    const headers = new Headers({
        Location: `https://${getCloudflareContext().env.APP_VIEW_URL}`,
    });

    // 複数クッキーを配列でまとめる
    // クッキー配列作成
    const setCookies = [
        'oauth_code_verifier=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0',
        'oauth_issuer=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0',
        'oauth_token_endpoint=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0',
        `oauth_key=${kvKey}.${signedKey}; HttpOnly; Secure; Path=/; SameSite=Lax`,
    ];


    // 1つずつ append ではなく、配列でループ
    setCookies.forEach(setCookies => headers.append('Set-Cookie', setCookies));

    return new Response(null, {
        status: 302,
        headers,
    });
}
