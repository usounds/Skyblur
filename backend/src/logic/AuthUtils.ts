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

export const getAuthenticatedDid = async (c: Context): Promise<string | null> => {
    const authorization = c.req.header('Authorization') || ''
    const rawDid = getCookie(c, 'oauth_did')
    const secret = (c.env as any).OAUTH_PRIVATE_KEY_JWK || 'default-fallback';

    if (authorization) {
        const audiences = getAcceptedAudiences(c);
        let lastError: unknown = null;

        // JWT検証
        for (const audience of audiences) {
            try {
                const verifiedJwt = await verifyJWT(authorization, audience);
                // verifyJWT throws if invalid, so if we get here, it is verified.
                const payload = verifiedJwt.payload as SkyblurJwtPayload;
                return payload.iss || payload.sub || '';
            } catch (e) {
                lastError = e;
            }
        }

        console.warn(`[auth] JWT verification failed for audiences ${audiences.join(', ')}:`, lastError);
    }

    if (rawDid) {
        const lastDotIndex = rawDid.lastIndexOf('.');
        if (lastDotIndex !== -1) {
            const did = rawDid.substring(0, lastDotIndex);
            const expectedSigned = await signDid(did, secret);
            if (rawDid === expectedSigned) {
                return did;
            }
        }
    }

    return null;
}
