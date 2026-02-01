import { Hono, type Context } from 'hono';
import { Env } from '@/index';
import { getAuthenticatedDid } from '@/logic/AuthUtils';

const app = new Hono<{ Bindings: Env }>();

app.post('/', async (c) => {
    try {
        const body = await c.req.json();
        const uri = body.uri;

        if (!uri) {
            return c.json({ success: false, error: 'Missing uri' }, 400);
        }

        const requesterDid = await getAuthenticatedDid(c);
        if (!requesterDid) {
            return c.json({ success: false, error: 'Not authenticated' }, 401);
        }

        // Verify the requester is the author
        if (!uri.startsWith(`at://${requesterDid}/`)) {
            return c.json({ success: false, error: 'Unauthorized' }, 403);
        }

        const doId = c.env.SKYBLUR_DO_RESTRICTED.idFromName(requesterDid);
        const doStub = c.env.SKYBLUR_DO_RESTRICTED.get(doId);

        const doUrl = new URL('http://do');
        doUrl.searchParams.set('key', uri);

        await doStub.fetch(doUrl.toString(), {
            method: 'DELETE',
        });

        return c.json({ success: true });
    } catch (e) {
        console.error('Error in deleteStored:', e);
        return c.json({ success: false, error: String(e) }, 500);
    }
});

export const handle = async (c: Context<{ Bindings: Env }>) => {
    return app.fetch(c.req.raw, c.env);
};
