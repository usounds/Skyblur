import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchServiceEndpoint } from '@/logic/JWTTokenHandler';
import { assertListOwnedByRepo, checkListMembership, isValidListUri } from '../listVisibility';

vi.mock('@/logic/JWTTokenHandler', () => ({
    fetchServiceEndpoint: vi.fn().mockResolvedValue('https://author.pds.example'),
}));

describe('listVisibility', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    it('validates list URI ownership shape', () => {
        expect(isValidListUri('at://did:plc:author/app.bsky.graph.list/list1', 'did:plc:author')).toBe(true);
        expect(isValidListUri('at://did:plc:other/app.bsky.graph.list/list1', 'did:plc:author')).toBe(false);
        expect(isValidListUri('at://did:plc:author/app.bsky.graph.listitem/item1', 'did:plc:author')).toBe(false);
    });

    it('confirms list ownership by fetching the list record', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({ value: { $type: 'app.bsky.graph.list', name: 'Allowed' } }),
        }));

        await expect(assertListOwnedByRepo('at://did:plc:author/app.bsky.graph.list/list1', 'did:plc:author')).resolves.toBe(true);
    });

    it('authorizes an exact list membership join with one Constellation request', async () => {
        const listUri = 'at://did:plc:author/app.bsky.graph.list/list1';
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                items: [{
                    linkRecord: {
                        did: 'did:plc:author',
                        collection: 'app.bsky.graph.listitem',
                        rkey: 'item1',
                    },
                    otherSubject: listUri,
                }],
                cursor: null,
            }),
        });
        vi.stubGlobal('fetch', fetchMock);

        await expect(checkListMembership({
            requesterDid: 'did:plc:viewer',
            authorDid: 'did:plc:author',
            listUri,
        })).resolves.toEqual({ ok: true });

        expect(fetchMock).toHaveBeenCalledOnce();
        expect(fetchServiceEndpoint).not.toHaveBeenCalled();

        const manyToManyUrl = new URL(fetchMock.mock.calls[0][0]);
        expect(manyToManyUrl.pathname).toBe('/xrpc/blue.microcosm.links.getManyToMany');
        expect(manyToManyUrl.searchParams.get('subject')).toBe('did:plc:viewer');
        expect(manyToManyUrl.searchParams.get('source')).toBe('app.bsky.graph.listitem:subject');
        expect(manyToManyUrl.searchParams.get('pathToOther')).toBe('list');
        expect(manyToManyUrl.searchParams.getAll('linkDid')).toEqual(['did:plc:author']);
        expect(manyToManyUrl.searchParams.getAll('otherSubject')).toEqual([listUri]);
        expect(manyToManyUrl.searchParams.get('limit')).toBe('1');
        expect(fetchMock.mock.calls[0][0]).toContain('subject=did%3Aplc%3Aviewer');
        expect(fetchMock.mock.calls[0][0]).not.toContain('did%253Aplc%253Aviewer');
    });

    it('denies when Constellation returns no exact list membership join', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                items: [],
                cursor: null,
            }),
        }));

        await expect(checkListMembership({
            requesterDid: 'did:plc:viewer',
            authorDid: 'did:plc:author',
            listUri: 'at://did:plc:author/app.bsky.graph.list/list1',
        })).resolves.toEqual({ ok: false, errorCode: 'NotListMember' });
    });

    it('denies a semantically mismatched many-to-many item', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                items: [{
                    linkRecord: {
                        did: 'did:plc:other',
                        collection: 'app.bsky.graph.listitem',
                        rkey: 'item1',
                    },
                    otherSubject: 'at://did:plc:author/app.bsky.graph.list/list1',
                }],
                cursor: null,
            }),
        }));

        await expect(checkListMembership({
            requesterDid: 'did:plc:viewer',
            authorDid: 'did:plc:author',
            listUri: 'at://did:plc:author/app.bsky.graph.list/list1',
        })).resolves.toEqual({ ok: false, errorCode: 'NotListMember' });
    });

    it('fails closed when Constellation rejects the query', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

        await expect(checkListMembership({
            requesterDid: 'did:plc:viewer',
            authorDid: 'did:plc:author',
            listUri: 'at://did:plc:author/app.bsky.graph.list/list1',
        })).resolves.toEqual({ ok: false, errorCode: 'ListMembershipCheckFailed' });
    });

    it('denies malformed many-to-many responses by default', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({ total: '1', records: [] }),
        }));

        await expect(checkListMembership({
            requesterDid: 'did:plc:viewer',
            authorDid: 'did:plc:author',
            listUri: 'at://did:plc:author/app.bsky.graph.list/list1',
        })).resolves.toEqual({ ok: false, errorCode: 'ListMembershipCheckFailed' });
    });
});
