import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handle } from '../getPost';
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

        // Setup Fetch
        mockFetch = vi.fn();
        global.fetch = mockFetch;
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => validRecord
        });

        // Setup DO Mocks
        mockDOFetch = vi.fn();
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
        expect(mockMirrorFetch).toHaveBeenCalledOnce();
    });

    it('should use an existing PDS-sourced mirror record while caching is enabled', async () => {
        mockMirrorFetch.mockResolvedValueOnce(Response.json({
            value: { text: 'cached PDS content', visibility: 'public', createdAt: '2024-01-01' },
            cid: 'pds-cid',
            source: 'pds',
            pdsGeneration: 'v2',
        }));
        const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/123' });

        await handle(c);

        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ text: 'cached PDS content' }));
        expect(mockFetch).not.toHaveBeenCalled();
        expect(mockMirrorFetch).toHaveBeenCalledOnce();
    });

    it('should store a PDS fallback in the mirror before returning it', async () => {
        vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                cid: 'pds-cid',
                value: { text: 'pds content', visibility: 'public', createdAt: '2024-01-01T00:00:00.000Z' },
            }),
        });
        const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/123' });

        await handle(c);

        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ text: 'pds content' }));
        const write = mockMirrorFetch.mock.calls.find(([, init]: [unknown, RequestInit?]) => init?.method === 'POST');
        expect(write).toBeDefined();
        expect(JSON.parse(write![1].body as string)).toEqual(expect.objectContaining({
            eventId: 'pds:v2:did:repo:123:pds-cid',
            did: 'did:repo',
            timeUs: 1_800_000_000_000_000,
            source: 'pds',
            commit: expect.objectContaining({
                operation: 'create', collection: 'uk.skyblur.post', rkey: '123', cid: 'pds-cid',
            }),
        }));
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
        expect(mockMirrorFetch).toHaveBeenCalledOnce();
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

    it('should re-read the mirror when a concurrent projection rejects the PDS snapshot', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ value: { text: 'stale PDS', visibility: 'public', createdAt: '2024-01-01' } }),
        });
        mockMirrorFetch
            .mockResolvedValueOnce(new Response(null, { status: 404 }))
            .mockResolvedValueOnce(Response.json({ accepted: true, projected: false, duplicate: false, stale: true }))
            .mockResolvedValueOnce(Response.json({
                value: { text: 'concurrent mirror update', visibility: 'public', createdAt: '2024-01-02' },
            }));
        const c = createCtx({ uri: 'at://did:repo/uk.skyblur.post/123' });

        await handle(c);

        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ text: 'concurrent mirror update' }));
        expect(mockMirrorFetch).toHaveBeenCalledTimes(3);
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
});
