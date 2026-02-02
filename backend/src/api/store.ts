import { UkSkyblurPostStore } from '../lexicon/index'
import { Context } from 'hono'
import { getAuthenticatedDid } from '../logic/AuthUtils'
import { safeParse } from '@atcute/lexicons'

export const handle = async (c: Context) => {
    console.log('[store] Request received');
    const body = await c.req.json();

    const result = safeParse(UkSkyblurPostStore.mainSchema.input.schema, body);

    if (!result.ok) {
        console.warn('[store] Validation failed', result.issues);
        return c.json({ success: false, message: `Validation failed: ${result.message}` }, 400);
    }

    const input = result.value;

    const { text, additional, visibility, uri } = input
    console.log(`[store] URI: ${uri}, Vis: ${visibility}`);

    const requesterDid = await getAuthenticatedDid(c);
    console.log(`[store] Requester: ${requesterDid}`);

    if (!requesterDid) {
        return c.json({ success: false, message: 'Authentication required' }, 401);
    }

    // Check if URI matches requester DID and collection (strict check)
    // uri: at://did:plc:xxx/uk.skyblur.post/xxx
    if (!uri.startsWith(`at://${requesterDid}/uk.skyblur.post/`)) {
        console.warn('[store] URI mismatch or invalid collection');
        return c.json({ success: false, message: 'URI does not match authenticated user or invalid collection' }, 403);
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
