import { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import { verifyJWT } from './JWTTokenHandler'

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

export const getAuthenticatedDid = async (c: Context): Promise<string | null> => {
    const authorization = c.req.header('Authorization') || ''
    const rawDid = getCookie(c, 'oauth_did')
    const secret = (c.env as any).OAUTH_PRIVATE_KEY_JWK || 'default-fallback';
    const origin = (c.env as any).APPVIEW_HOST
    const audience = `did:web:${origin}`

    if (authorization) {
        // デバッグログ: Authorizationヘッダー
        console.log('[AuthUtils] Authorization header received');

        // JWTペイロードをデコードしてログ出力
        const token = authorization.replace(/^(Bearer|DPoP)\s+/i, '').trim();
        const parts = token.split('.');
        if (parts.length === 3) {
            try {
                const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
                console.log('[AuthUtils] JWT payload:', JSON.stringify({
                    iss: payload.iss,
                    aud: payload.aud,
                    sub: payload.sub,
                    exp: payload.exp,
                    scope: payload.scope
                }));
            } catch (e) {
                console.error('[AuthUtils] JWT decode error:', e);
            }
        }

        // JWT検証
        console.log('[AuthUtils] Verifying JWT with audience:', audience);
        try {
            const veriry = await verifyJWT(authorization, audience);
            if (!veriry.verified) {
                console.warn('[AuthUtils] JWT verification failed');
            } else {
                const did = (veriry.payload as any).iss || (veriry as any).issuer || (veriry as any).did || (veriry.payload as any).sub || '';
                console.log('[AuthUtils] JWT verified, requesterDid:', did, 'payload:', JSON.stringify((veriry as any).payload));
                return did;
            }
        } catch (e) {
            console.error('[AuthUtils] JWT verification error:', e);
        }
    }

    if (rawDid) {
        console.log('[AuthUtils] Using cookie-based auth');
        const parts = rawDid.split('.');
        if (parts.length === 2) {
            const [did] = parts;
            const expectedSigned = await signDid(did, secret);
            if (rawDid === expectedSigned) {
                console.log('[AuthUtils] Cookie auth verified, requesterDid:', did);
                return did;
            }
        }
    }

    // Cookie auth failed or not present, returning null if JWT also failed/not present
    // Just logging if not found
    if (!authorization && !rawDid) {
        console.log('[AuthUtils] No authorization header or cookie found');
    }

    return null;
}
