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
        // JWT検証
        try {
            const veriry = await verifyJWT(authorization, audience);
            if (veriry.verified) {
                const did = (veriry.payload as any).iss || (veriry as any).issuer || (veriry as any).did || (veriry.payload as any).sub || '';
                return did;
            }
        } catch (e) {
            // silent fail
        }
    }

    if (rawDid) {
        const parts = rawDid.split('.');
        if (parts.length === 2) {
            const [did] = parts;
            const expectedSigned = await signDid(did, secret);
            if (rawDid === expectedSigned) {
                return did;
            }
        }
    }

    return null;
}
