import { afterEach, describe, expect, it, vi } from 'vitest';
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

    it('authorizes only after verifying the candidate listitem record', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({
                ok: true,
                json: vi.fn().mockResolvedValue({
                    total: 1,
                    records: [{ did: 'did:plc:author', collection: 'app.bsky.graph.listitem', rkey: 'item1' }],
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: vi.fn().mockResolvedValue({
                    value: {
                        $type: 'app.bsky.graph.listitem',
                        subject: 'did:plc:viewer',
                        list: 'at://did:plc:author/app.bsky.graph.list/list1',
                    },
                }),
            });
        vi.stubGlobal('fetch', fetchMock);

        await expect(checkListMembership({
            requesterDid: 'did:plc:viewer',
            authorDid: 'did:plc:author',
            listUri: 'at://did:plc:author/app.bsky.graph.list/list1',
        })).resolves.toEqual({ ok: true });

        const backlinksUrl = new URL(fetchMock.mock.calls[0][0]);
        expect(backlinksUrl.searchParams.get('subject')).toBe('did:plc:viewer');
        expect(fetchMock.mock.calls[0][0]).toContain('subject=did%3Aplc%3Aviewer');
        expect(fetchMock.mock.calls[0][0]).not.toContain('did%253Aplc%253Aviewer');
    });

    it('denies on candidate mismatch and reports unbounded pages as failed check', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                total: 2,
                records: [{ did: 'did:plc:author', collection: 'app.bsky.graph.listitem', rkey: 'item1' }],
            }),
        }));

        await expect(checkListMembership({
            requesterDid: 'did:plc:viewer',
            authorDid: 'did:plc:author',
            listUri: 'at://did:plc:author/app.bsky.graph.list/list1',
        })).resolves.toEqual({ ok: false, errorCode: 'ListMembershipCheckFailed' });
    });

    it('denies malformed backlinks responses by default', async () => {
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
