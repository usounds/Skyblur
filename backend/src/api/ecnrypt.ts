import { UkSkyblurPostEncrypt } from '@/lexicon/UkSkyblur'
import { deriveKey } from '@/logic/CryptHandler'
import { getAuthenticatedDid } from '@/logic/AuthUtils'
import { Context } from 'hono'

export const handle = async (c: Context) => {
    const { body, password } = await c.req.json() as UkSkyblurPostEncrypt.Input
    if (!body) {
        return c.json({ message: 'body is required.' }, 500);
    }
    if (!password) {
        return c.json({ message: 'password is required.' }, 500);
    }

    try {
        const requesterDid = await getAuthenticatedDid(c);

        if (!requesterDid) {
            console.warn('[encrypt] Authentication required - no requesterDid');
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
