import * as DPoP from 'dpop';
import { Context } from 'hono';
import { deleteCookie, getCookie } from 'hono/cookie';
import * as jose from 'jose';
import { setSignedCookie } from "../logic/CookieHandler";
import { jwks } from "../logic/type";

export const handle = async (c: Context) => {
    const url = new URL(c.req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')

    const appUrl = `https://${c.env.API_HOST}`

    if (!code || !state) {
        console.log('code or state is null')
        return c.redirect(appUrl, 302)
    }

    // --- クッキーから code_verifier などを取得 ---

    const codeVerifier = getCookie(c, 'oauth_code_verifier') || ''
    const issuer = getCookie(c, 'oauth_issuer') || ''
    const tokenEndpoint = getCookie(c, 'oauth_token_endpoint') || ''

    if (!codeVerifier || !issuer || !tokenEndpoint) {
        console.log('codeVerifier or issuer or tokenEndpoint are null')
        return c.redirect(appUrl, 302)
    }

    const client_id = `${appUrl}/client-metadata.json`
    const d = c.env.JWT_SECRET
    const privateJwk = { ...jwks.keys[0], d }

    // --- client_assertion (private_key_jwt) ---
    const key = await jose.importJWK(privateJwk, 'ES256')
    const now = Math.floor(Date.now() / 1000)
    const clientAssertion = await new jose.SignJWT({
        sub: client_id,
        iss: client_id,
        aud: issuer,
        jti: crypto.randomUUID(),
    })
        .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: privateJwk.kid })
        .setIssuedAt(now)
        .setExpirationTime(now + 300)
        .sign(key)

    // --- DPoP keypair ---
    const keypair = await DPoP.generateKeyPair('ES256', { extractable: true })

    // --- トークンリクエスト関数 ---
    async function requestToken(dpopNonce?: string): Promise<Response> {
        const proof = await DPoP.generateProof(keypair, tokenEndpoint!, 'POST', dpopNonce)

        const res = await fetch(tokenEndpoint!, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'DPoP': proof,
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code!,
                redirect_uri: `${appUrl}/oauth/callback`,
                client_id,
                code_verifier: codeVerifier,
                client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
                client_assertion: clientAssertion,
            }),
        })

        if (!res.ok) {
            const text = await res.clone().text()
            if (text.includes('use_dpop_nonce')) {
                const nonce = res.headers.get('DPoP-Nonce')
                if (!nonce) throw new Error('DPoP nonce required but missing')
                return requestToken(nonce)
            }
        }

        return res
    }

    const tokenRes = await requestToken()
    if (!tokenRes.ok) {
        const text = await tokenRes.text()
        return c.text(`Token request failed: ${text}`, 500)
    }

    const tokenData = await tokenRes.json()
    const kvKey = crypto.randomUUID()
    const myKv = c.env.SKYBLUR_OAUTH

    // アクセストークン保存
    await myKv.put(`session:${kvKey}`, JSON.stringify(tokenData))

    // 鍵保存
    const privateSignedJwk = await jose.exportJWK(keypair.privateKey)
    const publicSignedJwk = await jose.exportJWK(keypair.publicKey)
    await myKv.put(`dpopKey:${kvKey}`, JSON.stringify({ privateKey: privateSignedJwk, publicKey: publicSignedJwk }))

    // AUTH_SECRET で署名
    const cookieSecret = c.env.AUTH_SECRET


    // --- クッキー削除と新しいクッキー設定 ---
    function getRootDomain(host: string): string {
        const parts = host.split('.');
        if (parts.length >= 2) {
            return parts.slice(-2).join('.'); // 最後の2つを結合
        }
        return host;
    }

    const cookieOptions = {
        httpOnly: true,
        secure: true,
        path: '/',
        sameSite: 'None' as const,
        domain: getRootDomain(c.env.APPVIEW_HOST), // ここにドット
    }

    // 古いクッキーを消す
    deleteCookie(c, 'oauth_code_verifier',cookieOptions )
    deleteCookie(c, 'oauth_issuer', cookieOptions )
    deleteCookie(c, 'oauth_token_endpoint', cookieOptions )


    // 新しいクッキー
    //setSignedCookie(c, 'oauth_key', `${kvKey}`, cookieSecret, cookieOptions)
    setSignedCookie(c, 'oauth_key', `${kvKey}`, cookieSecret)

    return c.redirect( `https://${c.env.APPVIEW_HOST}`, 302)

}