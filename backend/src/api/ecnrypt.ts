import { UkSkyblurPostEncrypt } from '@/lexicon/UkSkyblur'
import { deriveKey } from '@/logic/CryptHandler'
import { verifyJWT } from '@/logic/JWTTokenHandler'
import { Context } from 'hono'
import { getCookie } from 'hono/cookie'

async function signDid(did: string, secret: string): Promise<string> {
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

export const handle = async (c: Context) => {
    const authorization = c.req.header('Authorization') || ''
    const rawDid = getCookie(c, 'oauth_did')
    const secret = (c.env as any).OAUTH_PRIVATE_KEY_JWK || 'default-fallback';

    const origin = (c.env as any).APPVIEW_HOST
    const audience = `did:web:${origin}`

    const { body, password } = await c.req.json() as UkSkyblurPostEncrypt.Input
    if (!body) {
        return c.json({ message: 'body is required.' }, 500);
    }
    if (!password) {
        return c.json({ message: 'password is required.' }, 500);
    }

    try {
        let requesterDid = ''
        if (authorization) {
            const veriry = await verifyJWT(authorization, audience)
            if (!veriry.verified) {
                return c.json({ message: 'Cannot verify JWT Token.' }, 403);
            }
            requesterDid = (veriry as any).did || (veriry as any).sub;
        } else if (rawDid) {
            const parts = rawDid.split('.');
            if (parts.length === 2) {
                const [did] = parts;
                const expectedSigned = await signDid(did, secret);
                if (rawDid === expectedSigned) {
                    requesterDid = did;
                }
            }
        }

        if (!requesterDid) {
            return c.json({ message: 'Authentication required.' }, 401);
        }

        const encoder = new TextEncoder();

        //Salt生成
        const salt = crypto.getRandomValues(new Uint8Array(16));
        let saltString = btoa(String.fromCharCode(...salt));
        const key = await deriveKey(password, salt)
        const iv = crypto.getRandomValues(new Uint8Array(12));
        let encryptBody = await crypto.subtle.encrypt(
            {
                name: 'AES-GCM',
                length: 256,
                iv: iv.buffer
            },
            key,
            encoder.encode(body)
        )

        const encryptedText = `${btoa(String.fromCharCode(...iv))}:${saltString}:${btoa(String.fromCharCode(...new Uint8Array(encryptBody)))}`;

        return c.json({ body: encryptedText })
    } catch (e) {
        console.log(e)
        return c.json({ message: 'Unexpected error. ' + e }, 500);
    }
}
