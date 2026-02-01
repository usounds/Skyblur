import { UkSkyblurPostStore } from '../lexicon/UkSkyblur'
import { Context } from 'hono'
import { getAuthenticatedDid } from '../logic/AuthUtils'

export const handle = async (c: Context) => {
    console.log('[store] Request received');
    const input = await c.req.json() as UkSkyblurPostStore.Input

    const { text, additional, visibility, uri } = input
    console.log(`[store] URI: ${uri}, Vis: ${visibility}`);

    if (!text || !uri || !visibility) {
        console.warn('[store] Missing fields');
        return c.json({ success: false, message: 'Missing required fields' }, 400);
    }

    const requesterDid = await getAuthenticatedDid(c);
    console.log(`[store] Requester: ${requesterDid}`);

    if (!requesterDid) {
        return c.json({ success: false, message: 'Authentication required' }, 401);
    }

    // Check if URI matches requester DID (basic check)
    // uri: at://did:plc:xxx/app.bsky.feed.post/xxx
    if (!uri.includes(requesterDid)) {
        console.warn('[store] URI mismatch');
        return c.json({ success: false, message: 'URI does not match authenticated user' }, 403);
    }

    try {
        const doNamespace = (c.env as any).SKYBLUR_DO_RESTRICTED as DurableObjectNamespace;
        // Sharding by User DID
        const doId = doNamespace.idFromName(requesterDid);

        // Log DO ID for debugging
        console.log(`[store] Storing to DO ID: ${doId.toString()} for user ${requesterDid}`);

        const stub = doNamespace.get(doId);

        const val = { text, additional };

        console.log(`[store] Sending PUT to DO... Key=${uri}`);
        const res = await stub.fetch(new Request('http://do/store?key=' + encodeURIComponent(uri), {
            method: 'PUT',
            body: JSON.stringify(val),
            headers: { 'Content-Type': 'application/json' }
        }));

        console.log(`[store] DO Response status: ${res.status}`);

        if (res.ok) {
            return c.json({ success: true });
        } else {
            console.error('[store] DO returned error');
            return c.json({ success: false, message: 'Failed to store data' }, 500);
        }

    } catch (e) {
        console.error('[store] Exception:', e);
        return c.json({ success: false, message: String(e) }, 500);
    }
}
