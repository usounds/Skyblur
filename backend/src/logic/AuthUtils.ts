import { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import { createCachedResolver, verifyJWT } from './JWTTokenHandler'

export async function signDid(did: string, secret: string): Promise<string> {
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

    const b64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

    return `${did}.${b64}`;
}

import { JWTPayload } from 'did-jwt'

interface SkyblurJwtPayload extends JWTPayload {
    iss: string
    lxm?: string
}

function getAcceptedAudiences(c: Context): string[] {
    const hosts = [
        c.env.APPVIEW_HOST,
        ...String(c.env.APPVIEW_PROXY_HOSTS || '')
            .split(',')
            .map((host) => host.trim())
            .filter(Boolean),
    ].filter(Boolean);

    return [...new Set(hosts)].map((host) => `did:web:${host}`);
}

export const getAuthenticatedDid = async (c: Context, requestId?: string): Promise<string | null> => {
    const startedAt = performance.now();
    const authorization = c.req.header('Authorization') || ''
    const rawDid = getCookie(c, 'oauth_did')
    const secret = (c.env as any).OAUTH_PRIVATE_KEY_JWK;

    if (authorization) {
        const audiences = getAcceptedAudiences(c);
        let lastError: unknown = null;
        let jwtAttempts = 0;
        const jwtStartedAt = performance.now();
        const cachedResolver = (c.env as any).SKYBLUR_DO
            ? createCachedResolver(c.env as any)
            : undefined;

        // JWT検証
        for (const audience of audiences) {
            jwtAttempts++;
            try {
                const verifiedJwt = cachedResolver
                    ? await verifyJWT(authorization, audience, cachedResolver)
                    : await verifyJWT(authorization, audience);
                // verifyJWT throws if invalid, so if we get here, it is verified.
                const payload = verifiedJwt.payload as SkyblurJwtPayload;
                console.info('[auth] timing', {
                    requestId,
                    mode: 'jwt',
                    audiences: audiences.length,
                    jwtAttempts,
                    jwtMs: Number((performance.now() - jwtStartedAt).toFixed(1)),
                    totalMs: Number((performance.now() - startedAt).toFixed(1)),
                    cachedResolver: Boolean(cachedResolver),
                    success: true,
                });
                return payload.iss || payload.sub || '';
            } catch (e) {
                lastError = e;
            }
        }

        // A rotated signing key can make a cached DID document stale. Refresh
        // once before falling back to cookie authentication.
        if (cachedResolver) {
            const refreshedResolver = createCachedResolver(c.env as any, true);
            for (const audience of audiences) {
                jwtAttempts++;
                try {
                    const verifiedJwt = await verifyJWT(authorization, audience, refreshedResolver);
                    const payload = verifiedJwt.payload as SkyblurJwtPayload;
                    console.info('[auth] timing', {
                        requestId,
                        mode: 'jwt-refresh',
                        audiences: audiences.length,
                        jwtAttempts,
                        jwtMs: Number((performance.now() - jwtStartedAt).toFixed(1)),
                        totalMs: Number((performance.now() - startedAt).toFixed(1)),
                        cachedResolver: true,
                        success: true,
                    });
                    return payload.iss || payload.sub || '';
                } catch (e) {
                    lastError = e;
                }
            }
        }

        console.warn(`[auth] JWT verification failed for audiences ${audiences.join(', ')}:`, lastError);
    }

    if (rawDid && secret) {
        const cookieStartedAt = performance.now();
        const lastDotIndex = rawDid.lastIndexOf('.');
        if (lastDotIndex !== -1) {
            const did = rawDid.substring(0, lastDotIndex);
            const expectedSigned = await signDid(did, secret);
            if (rawDid === expectedSigned) {
                console.info('[auth] timing', {
                    requestId,
                    mode: 'cookie',
                    cookieMs: Number((performance.now() - cookieStartedAt).toFixed(1)),
                    totalMs: Number((performance.now() - startedAt).toFixed(1)),
                    success: true,
                });
                return did;
            }
        }
    }

    console.info('[auth] timing', {
        requestId,
        mode: authorization ? 'jwt-failed' : 'anonymous',
        totalMs: Number((performance.now() - startedAt).toFixed(1)),
        success: false,
    });
    return null;
}
