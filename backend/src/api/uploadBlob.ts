import { Client } from '@atcute/client';
import type { } from '@atcute/atproto/types/repo/uploadBlob';
import { Context } from 'hono';

export const handle = async (c: Context, client: Client) => {
    const contentType = c.req.header('content-type');
    if (!contentType) {
        return c.json({ error: 'InvalidRequest', message: 'Request encoding (Content-Type) required but not provided' }, 400);
    }

    try {
        const body = await c.req.arrayBuffer();
        const blob = new Uint8Array(body);

        const response = await client.post('com.atproto.repo.uploadBlob', {
            input: blob,
            headers: {
                'content-type': contentType,
            },
        });

        if (!response.ok) {
            return c.json(response.data, 400);
        }

        return c.json(response.data, 200);
    } catch (e) {
        console.error('uploadBlob handler error:', e);
        return c.json({ error: 'InternalServerError', message: String(e) }, 500);
    }
}
