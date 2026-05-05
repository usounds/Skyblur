import { fetchServiceEndpoint } from '@/logic/JWTTokenHandler';

export type ListAuthorizationResult = {
    ok: boolean;
    errorCode?: 'NotListMember' | 'ListMembershipCheckFailed' | 'InvalidListUri' | 'ListUriMissing';
};

type BacklinksRecord = {
    did: string;
    collection: string;
    rkey: string;
};

type BacklinksResponse = {
    total: number;
    records: BacklinksRecord[];
};

function normalizeServiceEndpoint(endpoint: unknown): string | null {
    if (typeof endpoint === 'string') return endpoint;
    if (Array.isArray(endpoint) && typeof endpoint[0] === 'string') return endpoint[0];
    return null;
}

export function isValidListUri(listUri: unknown, repoDid: string): listUri is string {
    if (typeof listUri !== 'string') return false;
    const escapedDid = repoDid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^at://${escapedDid}/app\\.bsky\\.graph\\.list/[^/?#]+$`).test(listUri);
}

async function getRecord(repo: string, collection: string, rkey: string) {
    const endpoint = normalizeServiceEndpoint(await fetchServiceEndpoint(repo));
    if (!endpoint) throw new Error(`Cannot detect did[${repo}]'s pds.`);

    const url = new URL(`${endpoint.replace(/\/+$/, '')}/xrpc/com.atproto.repo.getRecord`);
    url.searchParams.set('repo', repo);
    url.searchParams.set('collection', collection);
    url.searchParams.set('rkey', rkey);

    const response = await fetch(url.toString(), {
        headers: {
            Accept: 'application/json',
            'User-Agent': 'SkyblurAPI/1.0',
        },
    });

    if (!response.ok) throw new Error(`Failed to get ${collection}/${rkey}`);
    return await response.json() as { value?: Record<string, unknown> };
}

export async function assertListOwnedByRepo(listUri: string, repoDid: string): Promise<boolean> {
    if (!isValidListUri(listUri, repoDid)) return false;
    const rkey = listUri.split('/').pop();
    if (!rkey) return false;

    try {
        const record = await getRecord(repoDid, 'app.bsky.graph.list', rkey);
        const value = record.value || {};
        return !value.$type || value.$type === 'app.bsky.graph.list';
    } catch (e) {
        console.error('[listVisibility] list ownership check failed', e);
        return false;
    }
}

function parseBacklinksResponse(value: unknown): BacklinksResponse | null {
    if (!value || typeof value !== 'object') return null;
    const data = value as { total?: unknown; records?: unknown };
    if (typeof data.total !== 'number' || !Array.isArray(data.records)) return null;

    const records: BacklinksRecord[] = [];
    for (const record of data.records) {
        if (!record || typeof record !== 'object') return null;
        const item = record as { did?: unknown; collection?: unknown; rkey?: unknown };
        if (typeof item.did !== 'string' || typeof item.collection !== 'string' || typeof item.rkey !== 'string') return null;
        records.push({ did: item.did, collection: item.collection, rkey: item.rkey });
    }

    return { total: data.total, records };
}

export async function checkListMembership(params: {
    requesterDid: string;
    authorDid: string;
    listUri: string;
}): Promise<ListAuthorizationResult> {
    const { requesterDid, authorDid, listUri } = params;
    if (!listUri) return { ok: false, errorCode: 'ListUriMissing' };
    if (!isValidListUri(listUri, authorDid)) return { ok: false, errorCode: 'InvalidListUri' };

    try {
        const url = new URL('https://constellation.microcosm.blue/xrpc/blue.microcosm.links.getBacklinks');
        url.searchParams.set('subject', requesterDid);
        url.searchParams.set('source', 'app.bsky.graph.listitem:subject');
        url.searchParams.append('did', authorDid);
        url.searchParams.set('limit', '100');
        url.searchParams.set('reverse', 'false');

        const response = await fetch(url.toString(), {
            headers: {
                Accept: 'application/json',
                'User-Agent': 'SkyblurAPI/1.0',
            },
        });

        if (!response.ok) return { ok: false, errorCode: 'ListMembershipCheckFailed' };

        const backlinks = parseBacklinksResponse(await response.json());
        if (!backlinks) return { ok: false, errorCode: 'ListMembershipCheckFailed' };

        for (const record of backlinks.records) {
            if (record.did !== authorDid || record.collection !== 'app.bsky.graph.listitem') continue;

            const candidate = await getRecord(record.did, record.collection, record.rkey);
            const value = candidate.value || {};
            if (
                (!value.$type || value.$type === 'app.bsky.graph.listitem') &&
                value.subject === requesterDid &&
                value.list === listUri
            ) {
                return { ok: true };
            }
        }

        if (backlinks.total > backlinks.records.length) {
            return { ok: false, errorCode: 'ListMembershipCheckFailed' };
        }

        return { ok: false, errorCode: 'NotListMember' };
    } catch (e) {
        console.error('[listVisibility] membership check failed', e);
        return { ok: false, errorCode: 'ListMembershipCheckFailed' };
    }
}
