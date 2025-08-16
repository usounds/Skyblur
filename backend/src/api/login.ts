import { getResolver } from '@/logic/DidPlcResolver';
import { fetchAuthorizationServer } from '@/logic/HandleXrpcProxy';
import { DIDDocument } from '@/logic/type';
import { DIDResolver, Resolver, ResolverRegistry } from 'did-resolver';
import { Context } from 'hono';
import { setCookie } from 'hono/cookie';
import * as jose from 'jose';
import { getResolver as getWebResolver } from 'web-did-resolver';
import { jwks } from "../logic/type";

export const handle = async (c: Context) => {

    const url = new URL(c.req.url)

    const myKv = c.env.SKYBLUR_OAUTH
    const handle = url.searchParams.get('handle')
    if (!handle) return c.text('Missing handle', 400)

    // Handle -> DID
    const profile = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${handle}`)

    if (!profile.ok) return c.text('Not found', 404)
    const data2 = await profile.json() as { did: string }
    const did = data2.did

    // host 判定
    // DID -> Service Endpoint
    const myResolver = getResolver();
    const web = getWebResolver();
    const resolver: ResolverRegistry = {
        'plc': myResolver.DidPlcResolver as unknown as DIDResolver,
        'web': web as unknown as DIDResolver,
    };
    const resolverInstance = new Resolver(resolver);

    const didDocument = await resolverInstance.resolve(did) as unknown as DIDDocument

    // KVにキャッシュ保存（JSONで保存）
    const cacheKey = `diddoc_${did}`;
    c.executionCtx.waitUntil(
        c.env.SKYBLUR_KV_CACHE.put(cacheKey, JSON.stringify(didDocument))
    );

    // Service Endpoint -> oauth-protected-resource  const endpoint =
    const endpoint = (didDocument.service as Array<{ id: string; serviceEndpoint: string }>)
        ?.find((svc) => svc.id === '#atproto_pds')?.serviceEndpoint;

    let oauthProtectResourceRaw: string | null = await myKv.get(`oauth-protected-resource:${endpoint}`)
    if (!oauthProtectResourceRaw) {
        const res = await fetch(`${endpoint}/.well-known/oauth-protected-resource`)
        if (!res.ok) throw new Error('Failed to fetch oauth-protected-resource')
        oauthProtectResourceRaw = await res.text()
        await myKv.put(`oauth-protected-resource:${endpoint}`, oauthProtectResourceRaw)
    }

    const oauthProtectResource: { authorization_servers: string[] } = JSON.parse(oauthProtectResourceRaw)
    const authorizationServers = oauthProtectResource.authorization_servers[0]
    const data = await fetchAuthorizationServer(myKv, authorizationServers)

    const login_hint = handle
    const token_endpoint = data.token_endpoint
    const authorization_endpoint = data.authorization_endpoint
    const issuer = data.issuer
    const pds = endpoint

    if (!login_hint || !token_endpoint || !authorization_endpoint || !issuer || !pds) {
        return c.text('Missing parameters', 400)
    }

    // JWT 生成
    const d = c.env.JWT_SECRET
    const privateJwk = { ...jwks.keys[0], d }
    const key = await jose.importJWK(privateJwk, 'ES256')

    const client_id = `https://${c.env.API_HOST}/client-metadata.json`
    const now = Math.floor(Date.now() / 1000)
    const clientAssertion = await new jose.SignJWT({
        sub: client_id,
        iss: client_id,
        aud: token_endpoint,
        jti: crypto.randomUUID(),
    })
        .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: privateJwk.kid })
        .setIssuedAt(now)
        .setExpirationTime(now + 300)
        .sign(key)

    // PKCE
    function generateCodeVerifier(): string {
        const array = new Uint8Array(64)
        crypto.getRandomValues(array)
        return btoa(String.fromCharCode(...array)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    }
    const codeVerifier = generateCodeVerifier()
    const codeChallengeBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))
    const code_challenge = btoa(String.fromCharCode(...new Uint8Array(codeChallengeBuffer)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

    const state = crypto.randomUUID()
    const params = new URLSearchParams({
        client_id,
        redirect_uri: `https://${c.env.API_HOST}/oauth/callback`,
        response_type: 'code',
        scope: 'atproto transition:generic',
        code_challenge,
        code_challenge_method: 'S256',
        state,
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: clientAssertion,
        login_hint,
    })
    const redirectUrl = `${authorization_endpoint}?${params.toString()}`

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

    // クッキー設定
    setCookie(c, 'oauth_code_verifier', codeVerifier, cookieOptions)
    setCookie(c, 'oauth_issuer', issuer || '', cookieOptions)
    setCookie(c, 'oauth_token_endpoint', token_endpoint || '', cookieOptions)

    // JSON レスポンス

    return c.json({ url: redirectUrl })

}