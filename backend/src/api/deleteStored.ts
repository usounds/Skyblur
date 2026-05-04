import { type Context } from 'hono';
import { Env } from '@/index';
import { getAuthenticatedDid } from '@/logic/AuthUtils';

function jsonResponse(c: Context<{ Bindings: Env }>, body: unknown, status = 200) {
    if (typeof c.json === 'function') {
        return c.json(body, status as never);
    }

    return Response.json(body, { status });
}

async function readJsonBody(c: Context<{ Bindings: Env }>) {
    if (typeof c.req.json === 'function') {
        return c.req.json();
    }

    return c.req.raw.json();
}

export const handle = async (c: Context<{ Bindings: Env }>) => {
    try {
        const body = await readJsonBody(c);
        const uri = body.uri;

        if (!uri) {
            return jsonResponse(c, { success: false, error: 'Missing uri' }, 400);
        }

        const requesterDid = await getAuthenticatedDid(c);
        if (!requesterDid) {
            return jsonResponse(c, { success: false, error: 'Not authenticated' }, 401);
        }

        // Verify the requester is the author and the collection is correct
        if (!uri.startsWith(`at://${requesterDid}/uk.skyblur.post/`)) {
            return jsonResponse(c, { success: false, error: 'Unauthorized or invalid collection' }, 403);
        }

        const rkey = uri.split('/').pop();
        if (!rkey) {
            return jsonResponse(c, { success: false, error: 'Invalid URI' }, 400);
        }

        const doId = c.env.SKYBLUR_DO_RESTRICTED.idFromName(requesterDid);
        const doStub = c.env.SKYBLUR_DO_RESTRICTED.get(doId);

        const doUrl = new URL('http://do');
        doUrl.searchParams.set('key', rkey);

        const doRes = await doStub.fetch(doUrl.toString(), {
            method: 'DELETE',
        });

        if (!doRes.ok) {
            console.error('[deleteStored] DO returned error:', await doRes.text());
            return jsonResponse(c, { success: false, error: 'Failed to delete from storage' }, 500);
        }

        return jsonResponse(c, { success: true });
    } catch (e) {
        console.error('Error in deleteStored:', e);
        return jsonResponse(c, { success: false, error: String(e) }, 500);
    }
};
