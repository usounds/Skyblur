import { Context } from 'hono'
import { verifyJWT } from '../logic/JWTTokenHandler'
import { deriveKey } from '../logic/CryptHandler'

export const handle = async (c: Context) => {
    const authorization = c.req.header('Authorization') || ''
    if (!authorization) {
        return c.json({ message: 'Authorization Header required. This api shoud be call via atproto-proxy.' }, 500);
    }

    const origin = 'skyblur.uk'
    const audience = `did:web:${origin}`

    const { body, password } = await c.req.json();
    if (!body) {
        return c.json({ message: 'body is required.' }, 500);
    }
    if (!password) {
        return c.json({ message: 'password is required.' }, 500);
    }

    try {
        /*
        const veriry = await verifyJWT(authorization, audience)

        if (!veriry.verified) {
            return c.json({ message: 'Cannot verify JWT Token.' }, 500);

        }
            */
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
