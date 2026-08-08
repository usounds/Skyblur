import { fetchServiceEndpoint } from '@/logic/JWTTokenHandler';

export type ListAuthorizationResult = {
    ok: boolean;
    errorCode?: 'NotListMember' | 'ListMembershipCheckFailed' | 'InvalidListUri' | 'ListUriMissing';
};

type ManyToManyItem = {
    linkRecord: {
        did: string;
        collection: string;
        rkey: string;
    };
    otherSubject: string;
};

type ManyToManyResponse = {
    items: ManyToManyItem[];
};

type RecordReference = {
    did: string;
    collection: string;
    rkey: string;
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

function parseManyToManyResponse(value: unknown): ManyToManyResponse | null {
    if (!value || typeof value !== 'object') return null;
    const data = value as { items?: unknown };
    if (!Array.isArray(data.items)) return null;

    const items: ManyToManyItem[] = [];
    for (const item of data.items) {
        if (!item || typeof item !== 'object') return null;
        const candidate = item as { linkRecord?: unknown; otherSubject?: unknown };
        if (!candidate.linkRecord || typeof candidate.linkRecord !== 'object' || typeof candidate.otherSubject !== 'string') return null;
        const linkRecord = candidate.linkRecord as Partial<RecordReference>;
        if (typeof linkRecord.did !== 'string' || typeof linkRecord.collection !== 'string' || typeof linkRecord.rkey !== 'string') return null;
        items.push({
            linkRecord: {
                did: linkRecord.did,
                collection: linkRecord.collection,
                rkey: linkRecord.rkey,
            },
            otherSubject: candidate.otherSubject,
        });
    }

    return { items };
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
        const url = new URL('https://constellation.microcosm.blue/xrpc/blue.microcosm.links.getManyToMany');
        url.searchParams.set('subject', requesterDid);
        url.searchParams.set('source', 'app.bsky.graph.listitem:subject');
        url.searchParams.set('pathToOther', 'list');
        url.searchParams.append('linkDid', authorDid);
        url.searchParams.append('otherSubject', listUri);
        url.searchParams.set('limit', '1');

        const response = await fetch(url.toString(), {
            headers: {
                Accept: 'application/json',
                'User-Agent': 'SkyblurAPI/1.0',
            },
        });

        if (!response.ok) return { ok: false, errorCode: 'ListMembershipCheckFailed' };

        const result = parseManyToManyResponse(await response.json());
        if (!result) return { ok: false, errorCode: 'ListMembershipCheckFailed' };

        const isMember = result.items.some(({ linkRecord, otherSubject }) => (
            linkRecord.did === authorDid &&
            linkRecord.collection === 'app.bsky.graph.listitem' &&
            otherSubject === listUri
        ));

        return isMember
            ? { ok: true }
            : { ok: false, errorCode: 'NotListMember' };
    } catch (e) {
        console.error('[listVisibility] membership check failed', e);
        return { ok: false, errorCode: 'ListMembershipCheckFailed' };
    }
}
