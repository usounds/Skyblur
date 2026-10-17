import { DatabaseSync } from 'node:sqlite';
import { RestrictedPostDO } from '../RestrictedPostDO';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handle } from '../getPost';
import { pdsReadCache } from '../pdsReadCache';
import * as ListVisibility from '../listVisibility';
import * as AuthUtils from '@/logic/AuthUtils';
import * as JWTTokenHandler from '@/logic/JWTTokenHandler';
import * as CryptHandler from '@/logic/CryptHandler';
import { Client } from '@atcute/client';

// Mocks
vi.mock('@/logic/AuthUtils');
vi.mock('@/logic/JWTTokenHandler');
vi.mock('@/logic/CryptHandler');

const { mockClientGet } = vi.hoisted(() => {
    return { mockClientGet: vi.fn() };
});

vi.mock('@atcute/client', () => {
    return {
        Client: vi.fn(function () {
            return {
                get: mockClientGet
            };
        }),
        simpleFetchHandler: vi.fn()
    };
});

describe('getPost API', () => {
    let mockFetch: any;
    // Define mocks variables but init them in beforeEach logic effectively or just keep refs
    let mockDOFetch: any;
    let mockDONamespace: any;
    let mockMirrorFetch: any;
    let mockMirrorNamespace: any;
    let baseEnv: any;

    const validRecord = {
        value: {
            text: 'secret post',
            createdAt: '2024-01-01',
            visibility: 'followers'
        }
    };

    beforeEach(() => {
        vi.resetAllMocks();
        pdsReadCache.clear();

        // Setup Fetch
        mockFetch = vi.fn();
        global.fetch = (async (...args: Parameters<typeof fetch>) => {
            const response = await mockFetch(...args);
            if (response instanceof Response) return response;
            if (response.json) return Response.json(await response.json(), { status: response.ok ? 200 : response.status || 500 });
            return new Response(await response.text(), { status: response.ok ? 200 : response.status || 500 });
        }) as typeof fetch;
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => validRecord
        });

        // Setup DO Mocks
        mockDOFetch = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
        mockDONamespace = {
            idFromName: vi.fn().mockReturnValue('do-id'),
            get: vi.fn().mockReturnValue({ fetch: mockDOFetch })
        };
        mockMirrorFetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => Promise.resolve(
            init?.method === 'POST'
                ? Response.json({ accepted: true, projected: true, duplicate: false, stale: false })
                : new Response(null, { status: 404 })
        ));
        mockMirrorNamespace = {
            idFromName: vi.fn().mockReturnValue('mirror-do-id'),
            get: vi.fn().mockReturnValue({ fetch: mockMirrorFetch })
        };
        baseEnv = {
            SKYBLUR_DO_RESTRICTED: mockDONamespace,
            SKYBLUR_DO_POST_MIRROR: mockMirrorNamespace,
            PDS_READ_THROUGH_CACHE: 'true',
        };

        // Default Logic Mocks
        // @ts-ignore
        AuthUtils.getAuthenticatedDid.mockResolvedValue('did:example:requester');
        // @ts-ignore
        JWTTokenHandler.fetchServiceEndpoint.mockResolvedValue('https://pds.example');

        // Mock Client default
        mockClientGet.mockResolvedValue({ data: { relationships: [] } });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const createCtx = (body: any, did: string | null = 'did:example:requester') => {
        // @ts-ignore
        AuthUtils.getAuthenticatedDid.mockResolvedValue(did);
        return {
            req: {
                json: vi.fn().mockResolvedValue(body),
                header: vi.fn().mockReturnValue('Bearer token')
            },
            env: baseEnv,
            json: vi.fn()
        } as any;
    };

    it.each([false, true])('serves a public mirror during PDS outage with a real restricted DO (initialized=%s)', async (initialized) => {
        const db = new DatabaseSync(':memory:');
        try {
            if (initialized) db.exec("CREATE TABLE posts (rkey TEXT PRIMARY KEY, text TEXT, additional TEXT, visibility TEXT, list_uri TEXT, created_at TEXT); CREATE TABLE config (key TEXT PRIMARY KEY, value TEXT)");
            const exec = vi.fn((query: string, ...args: unknown[]) => {
                const rows = db.prepare(query).all(...args as never[]);
                return { toArray: () => rows, one: () => { if (rows.length !== 1) throw new Error('Expected exactly one row'); return rows[0]; } };
            });
            const object = new RestrictedPostDO({ storage: { sql: { exec } } } as unknown as DurableObjectState, {} as never);
            mockDOFetch.mockImplementation((request: Request) => object.fetch(request));
            mockMirrorFetch.mockImplementation(async () => Response.json({ value: { text: 'mirror body', visibility: 'public' }, source: 'jetstream' }));
            mockFetch.mockRejectedValue(new Error('PDS offline'));
            const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/public' }, null);
            await handle(c);
            expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ text: 'mirror body' }));
            expect(mockFetch).not.toHaveBeenCalled();
            expect(exec.mock.calls.every(([query]) => /^\s*(SELECT|PRAGMA)/i.test(query))).toBe(true);
            if (!initialized) expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()).toEqual([]);
        } finally { db.close(); }
    });

    it('expires a PDS snapshot despite cache hits before the deadline', async () => {
        const now = vi.spyOn(Date, 'now');
        now.mockReturnValue(100000);
        mockFetch.mockImplementation(async () => Response.json({ value: { text: 'old', visibility: 'public' } }));
        await handle(createCtx({ uri: 'at://did:repo/uk.skyblur.post/ttl' }, null));
        now.mockReturnValue(159000);
        await handle(createCtx({ uri: 'at://did:repo/uk.skyblur.post/ttl' }, null));
        expect(mockFetch).toHaveBeenCalledOnce();
        mockFetch.mockImplementation(async () => Response.json({ value: { text: 'masked', visibility: 'password', encryptBody: { ref: 'new-cid' } } }));
        now.mockReturnValue(161000);
        const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/ttl' }, null);
        await handle(c);
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 'PasswordRequired', encryptCid: 'new-cid' }));
    });

    it('should return error if uri is missing', async () => {
        const c = createCtx({});
        await handle(c);
        // Based on previous revert
        expect(c.json).toHaveBeenCalledWith({ message: 'Invalid uri format' }, 400);
    });

    it('should return error if collection is invalid', async () => {
        const c = createCtx({ uri: 'at://did:repo/com.example.post/123' });
        await handle(c);
        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Collection should be') }), 400);
    });

    it('should handle PDS fetch error', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                value: {
                    text: 'enc',
                    visibility: 'password',
                    encryptBody: { ref: 'cid123' }
                }
            })
        });
        // @ts-ignore
        JWTTokenHandler.fetchServiceEndpoint.mockRejectedValue(new Error('PDS fail'));
        const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/123', password: 'any' });

        await handle(c);
        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Cannot getRecord') }), 500);
    });

    it('should handle getRecord fetch error', async () => {
        mockFetch.mockResolvedValue({ ok: false, status: 404, text: () => 'Not Found' });
        const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/123' });

        await handle(c);
        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Cannot getRecord') }), 500);
    });

    it('should use the mirror without requesting the PDS when the record exists', async () => {
        mockMirrorFetch.mockResolvedValueOnce(Response.json({
            value: { text: 'mirror content', visibility: 'public', createdAt: '2024-01-01' },
            cid: 'mirror-cid',
            timeUs: 1_704_067_200_000_000,
            source: 'jetstream',
        }));
        baseEnv.PDS_READ_THROUGH_CACHE = 'false';
        const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/123' });

        await handle(c);

        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ text: 'mirror content' }));
        expect(JWTTokenHandler.fetchServiceEndpoint).not.toHaveBeenCalled();
        expect(mockFetch).not.toHaveBeenCalled();
        expect(mockMirrorFetch).toHaveBeenCalledOnce();
    });

    it.each([
        ['unset', undefined],
        ['false', 'false'],
    ])('should bypass an existing PDS-sourced mirror record while caching is %s', async (_label, flag) => {
        if (flag === undefined) {
            delete baseEnv.PDS_READ_THROUGH_CACHE;
        } else {
            baseEnv.PDS_READ_THROUGH_CACHE = flag;
        }
        mockMirrorFetch.mockResolvedValueOnce(Response.json({
            value: { text: 'stale cached PDS content', visibility: 'public', createdAt: '2024-01-01' },
            cid: 'stale-pds-cid',
            source: 'pds',
        }));
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                cid: 'current-pds-cid',
                value: { text: 'current PDS content', visibility: 'public', createdAt: '2024-01-02' },
            }),
        });
        const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/123' });

        await handle(c);

        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ text: 'current PDS content' }));
        expect(mockFetch).toHaveBeenCalledOnce();
        expect(mockMirrorFetch).toHaveBeenCalledTimes(2);
    });

    it('ignores legacy durable PDS snapshots even while caching is enabled', async () => {
        mockMirrorFetch.mockImplementation(async () => Response.json({
            value: { text: 'stale cached PDS content', visibility: 'public', createdAt: '2024-01-01' },
            source: 'pds', pdsGeneration: 'v2',
        }));
        mockFetch.mockResolvedValue(Response.json({ value: { text: 'live PDS content', visibility: 'public' } }));
        const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/123' });
        await handle(c);
        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ text: 'live PDS content' }));
        expect(mockFetch).toHaveBeenCalledOnce();
    });

    it('caches a PDS fallback ephemerally without durable writes, including anonymous reads', async () => {
        mockFetch.mockResolvedValue(Response.json({ value: { text: 'pds content', visibility: 'public' } }));
        for (let i = 0; i < 2; i++) {
            const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/123' }, null);
            await handle(c);
            expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ text: 'pds content' }));
        }
        expect(mockFetch).toHaveBeenCalledOnce();
        expect(mockMirrorFetch.mock.calls.every(([, init]: [unknown, RequestInit?]) => !init?.method || init.method === 'GET')).toBe(true);
    });

    it.each([
        ['unset', undefined],
        ['false', 'false'],
    ])('should not store a PDS fallback while read-through caching is %s', async (_label, flag) => {
        if (flag === undefined) {
            delete baseEnv.PDS_READ_THROUGH_CACHE;
        } else {
            baseEnv.PDS_READ_THROUGH_CACHE = flag;
        }
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                cid: 'pds-cid',
                value: { text: 'uncached PDS content', visibility: 'public', createdAt: '2024-01-01' },
            }),
        });
        const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/123' });

        await handle(c);

        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ text: 'uncached PDS content' }));
        expect(mockMirrorFetch).toHaveBeenCalledTimes(2);
        expect(mockMirrorFetch).toHaveBeenCalledWith(expect.stringContaining('/record?'));
    });

    it('should still return the PDS record when mirror storage fails', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ value: { text: 'available', visibility: 'public', createdAt: '2024-01-01' } }),
        });
        mockMirrorFetch
            .mockResolvedValueOnce(new Response(null, { status: 404 }))
            .mockResolvedValueOnce(Response.json({ error: 'unavailable' }, { status: 503 }));
        const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/123' });

        await handle(c);

        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ text: 'available' }));
    });

    it('prefers a concurrent canonical projection over a PDS snapshot', async () => {
        mockFetch.mockResolvedValue(Response.json({ value: { text: 'stale PDS', visibility: 'public' } }));
        mockMirrorFetch.mockResolvedValueOnce(new Response(null, { status: 404 }))
            .mockResolvedValueOnce(Response.json({ value: { text: 'concurrent mirror update', visibility: 'public' }, source: 'jetstream' }));
        const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/123' });
        await handle(c);
        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ text: 'concurrent mirror update' }));
        expect(mockMirrorFetch).toHaveBeenCalledTimes(2);
    });

    it('should not revive a mirror tombstone from the PDS', async () => {
        baseEnv.PDS_READ_THROUGH_CACHE = 'false';
        mockMirrorFetch.mockResolvedValueOnce(new Response(null, { status: 410 }));
        const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/123' });

        await handle(c);

        expect(mockFetch).not.toHaveBeenCalled();
        expect(c.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining('Cannot getRecord') }),
            500,
        );
    });

    it.each([200, 500])('bounds attacker-controlled PDS bodies for status %i without caching them', async (status) => {
        mockFetch.mockResolvedValue(new Response('x'.repeat(65 * 1024), { status }));
        const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/oversized' }, null);
        await handle(c);
        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Cannot getRecord') }), 500);
        expect(pdsReadCache.get('did:repo', 'oversized')).toBeUndefined();
        expect(mockMirrorFetch.mock.calls.every(([, init]: [unknown, RequestInit?]) => !init?.method)).toBe(true);
    });

    it('does not serve a cached PDS snapshot over a later canonical tombstone', async () => {
        pdsReadCache.set('did:repo', '123', { value: { text: 'cached', visibility: 'public' } });
        mockMirrorFetch.mockResolvedValueOnce(new Response(null, { status: 410 }));
        const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/123' }, null);
        await handle(c);
        expect(c.json).toHaveBeenCalledWith(expect.anything(), 500);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    // --- Visibility Tests ---

    it('should require login if not authenticated for protected post', async () => {
        const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/123' }, null); // No DID
        await handle(c);

        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({
            errorCode: 'AuthRequired',
            visibility: 'followers'
        }));
    });

    it('should allow author to view their own post without relationship check', async () => {
        const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/123' }, 'did:repo'); // requester == repo

        // Mock DO response
        mockDOFetch.mockResolvedValue({ ok: true, json: async () => ({ text: 'Decrypted content', additional: '' }) });

        await handle(c);

        expect(mockClientGet).not.toHaveBeenCalled(); // No graph check needed
        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ text: 'Decrypted content' }));
    });

    it('should verify "followers" visibility - Success', async () => {
        const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/123' });

        // Mock Relationship: Requester follows Author
        mockClientGet.mockResolvedValue({
            data: { relationships: [{ $type: 'app.bsky.graph.defs#relationship', following: 'at://link', followedBy: null }] }
        });

        // Mock DO
        mockDOFetch.mockResolvedValue({ ok: true, json: async () => ({ text: 'OK', additional: '' }) });

        await handle(c);
        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ text: 'OK' }));
    });

    it('should verify "followers" visibility - Failure', async () => {
        const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/123' });

        // Mock Relationship: None
        mockClientGet.mockResolvedValue({
            data: { relationships: [{ $type: 'app.bsky.graph.defs#relationship', following: null, followedBy: null }] }
        });

        await handle(c);
        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({
            errorCode: 'NotFollower',
            text: 'secret post' // Returns partial/masked data usually, here logic returns recordObj.text from PDS as fallback/preview? 
            // Checking logic: returns json with message "Not authorized..."
        }));
    });

    it('should verify "following" visibility - Success', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ value: { ...validRecord.value, visibility: 'following' } })
        });
        const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/123' });

        // Mock Relationship: Author follows Requester
        mockClientGet.mockResolvedValue({
            data: { relationships: [{ $type: 'app.bsky.graph.defs#relationship', following: null, followedBy: 'at://link' }] }
        });

        mockDOFetch.mockResolvedValue({ ok: true, json: async () => ({ text: 'OK', additional: '' }) });

        await handle(c);
        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ text: 'OK' }));
    });

    it('should verify "mutual" visibility - Success', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ value: { ...validRecord.value, visibility: 'mutual' } })
        });
        const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/123' });

        // Mock Relationship: Mutual
        mockClientGet.mockResolvedValue({
            data: { relationships: [{ $type: 'app.bsky.graph.defs#relationship', following: 'at://1', followedBy: 'at://2' }] }
        });

        mockDOFetch.mockResolvedValue({ ok: true, json: async () => ({ text: 'Mutual OK', additional: '' }) });

        await handle(c);
        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ text: 'Mutual OK' }));
    });

    it('should handle DO content missing', async () => {
        const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/123' }, 'did:repo');

        mockDOFetch.mockResolvedValue({ ok: false }); // DO 404

        await handle(c);
        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 'ContentMissing' }));
    });

    // --- Password Tests ---

    it('should handle password visibility - missing password', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                value: {
                    text: 'enc',
                    visibility: 'password',
                    encryptBody: { ref: 'cid123' }
                }
            })
        });
        const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/123' });

        await handle(c);
        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({
            errorCode: 'PasswordRequired',
            encryptCid: 'cid123'
        }));
    });

    it('should handle password visibility - incorrect password', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                value: {
                    text: 'enc',
                    visibility: 'password',
                    encryptBody: { ref: 'cid123' }
                }
            })
        });
        const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/123', password: 'wrong' });

        // @ts-ignore
        CryptHandler.getDecrypt.mockRejectedValue(new Error('Decrypt failed'));

        await handle(c);
        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Decrypt failed' }), 403);
    });

    it('should handle password visibility - success', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                value: {
                    text: 'enc',
                    visibility: 'password',
                    encryptBody: { ref: 'cid123' }
                }
            })
        });
        const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/123', password: 'correct' });

        // @ts-ignore
        CryptHandler.getDecrypt.mockResolvedValue({ text: 'Decrypted', additional: '' });

        await handle(c);
        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ text: 'Decrypted' }));
    });

    it('should handle public visibility (fallthrough)', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                value: {
                    text: 'public content',
                    visibility: 'public',
                    createdAt: '2024-01-01'
                }
            })
        });
        const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/123' });

        await handle(c);
        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({
            text: 'public content',
            visibility: 'public'
        }));
    });

    it('should handle password visibility - invalid reference link', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                value: {
                    text: 'enc',
                    visibility: 'password',
                    encryptBody: {} // Missing ref
                }
            })
        });
        const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/123' });

        await handle(c);
        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Reference link is missing') }), 500);
    });

    it('should handle relationship check error', async () => {
        const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/123' });
        // @ts-ignore
        mockClientGet.mockRejectedValue(new Error('Graph error'));

        await handle(c);
        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({
            errorCode: 'RelationshipCheckFailed'
        }));
    });

    it('should handle relationship not found (empty array)', async () => {
        const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/123' });
        mockClientGet.mockResolvedValue({ data: { relationships: [] } });

        await handle(c);
        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({
            errorCode: 'RelationshipNotFound'
        }));
    });

    it('should re-verify authorization when DO visibility differs from recordObj visibility (Issue 3)', async () => {
        // Record says followers, but DO was edited to list
        const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/123' }, 'did:requester');

        // Requester follows author (so recordObj check passes)
        mockClientGet.mockResolvedValue({
            data: { relationships: [{ $type: 'app.bsky.graph.defs#relationship', following: 'at://link', followedBy: null }] }
        });

        // DO has edited visibility: 'list' with a listUri where user is not a member
        mockDOFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                text: 'replacement restricted text',
                additional: '',
                visibility: 'list',
                listUri: 'at://did:repo/app.bsky.graph.list/target-list'
            })
        });

        await handle(c);

        // Should be rejected under the new 'list' ACL
        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({
            errorCode: expect.any(String),
            visibility: 'list'
        }));
        expect(c.json).not.toHaveBeenCalledWith(expect.objectContaining({
            text: 'replacement restricted text'
        }));
    });

    it('rechecks list membership when only the restricted list URI changes', async () => {
        const oldList = 'at://did:repo/app.bsky.graph.list/old';
        const newList = 'at://did:repo/app.bsky.graph.list/new';
        mockFetch.mockResolvedValue(Response.json({ value: {
            text: '○○○○○', visibility: 'list', listUri: oldList, createdAt: '2024-01-01',
        } }));
        mockDOFetch.mockResolvedValue(Response.json({
            text: 'new list private text', visibility: 'list', listUri: newList, additional: '',
        }));
        const membership = vi.spyOn(ListVisibility, 'checkListMembership')
            .mockResolvedValueOnce({ ok: true })
            .mockResolvedValueOnce({ ok: false, errorCode: 'NotListMember' });
        const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/123' });
        await handle(c);
        expect(membership).toHaveBeenNthCalledWith(2, expect.objectContaining({ listUri: newList }));
        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 'NotListMember', listUri: newList }));
        expect(JSON.stringify(c.json.mock.calls)).not.toContain('new list private text');
    });

    it('rechecks the live PDS ACL when a public mirror conflicts with restricted storage', async () => {
        mockMirrorFetch.mockResolvedValueOnce(Response.json({
            value: { text: 'stale public text', visibility: 'public', createdAt: '2024-01-01' },
            source: 'jetstream',
        }));
        mockFetch.mockResolvedValue(Response.json({ value: {
            text: '○○○○○', visibility: 'followers', createdAt: '2024-01-01',
        } }));
        mockDOFetch.mockResolvedValue(Response.json({
            text: 'new restricted secret', visibility: 'followers', additional: '',
        }));
        const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/123' }, null);
        await handle(c);
        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({
            text: '○○○○○', errorCode: 'AuthRequired', visibility: 'followers',
        }));
        expect(mockFetch).toHaveBeenCalledOnce();
    });

    it.each([null, 'did:repo', 'did:example:requester'])(
        'never returns stale restricted plaintext after publishing for viewer %s', async (viewer) => {
            mockMirrorFetch.mockResolvedValueOnce(Response.json({
                value: { text: 'current public body', visibility: 'public', createdAt: '2024-01-01' },
                source: 'jetstream',
            }));
            mockFetch.mockResolvedValue(Response.json({ value: {
                text: 'current public body', additional: 'current public note', visibility: 'public', createdAt: '2024-01-01',
            } }));
            mockDOFetch.mockResolvedValue(Response.json({
                text: 'old restricted secret', additional: 'old note', visibility: 'followers',
            }));
            mockClientGet.mockResolvedValue({ data: { relationships: [{
                $type: 'app.bsky.graph.defs#relationship', following: 'at://follow',
            }] } });
            const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/123' }, viewer);
            await handle(c);
            expect(c.json).toHaveBeenCalledWith(expect.objectContaining({
                text: 'current public body', additional: 'current public note', visibility: 'public',
            }));
            expect(JSON.stringify(c.json.mock.calls)).not.toContain('old restricted secret');
        },
    );

    it.each(['throw', '500', 'invalid-json'])(
        'does not return public mirror plaintext if restricted check fails with %s and PDS is unavailable', async (failure) => {
            mockMirrorFetch.mockResolvedValueOnce(Response.json({
                value: { text: 'stale mirror secret', visibility: 'public', createdAt: '2024-01-01' },
                source: 'jetstream',
            }));
            if (failure === 'throw') mockDOFetch.mockRejectedValue(new Error('unavailable'));
            else mockDOFetch.mockResolvedValue(new Response('bad', { status: failure === '500' ? 500 : 200 }));
            mockFetch.mockRejectedValue(new Error('PDS unavailable'));
            const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/123' }, null);
            await handle(c);
            expect(c.json).toHaveBeenCalledWith({ message: 'Cannot verify current post visibility.' }, 503);
            expect(JSON.stringify(c.json.mock.calls)).not.toContain('stale mirror secret');
        },
    );
});
