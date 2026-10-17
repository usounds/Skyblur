import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCachedResolver, resolverInstance } from '../JWTTokenHandler';

/**
 * Security Test Suite: DID Document Cache Resolver
 * 
 * Pentest Finding: "Stale DID-document cache permits authentication with a 
 * rotated signing key for up to 24 hours"
 * 
 * This test suite verifies the createCachedResolver mitigation:
 * - forceRefresh=true MUST bypass cache and resolve fresh
 * - forceRefresh=true MUST memoize per-resolver to avoid redundant resolutions
 * - forceRefresh=false can use cache (for non-authentication use cases)
 */

describe('JWTTokenHandler - Cache Resolver Security Tests', () => {
    let mockEnv: any;
    let mockStub: any;
    let mockFetch: any;

    beforeEach(() => {
        vi.resetAllMocks();
        
        mockFetch = vi.fn();
        mockStub = {
            fetch: mockFetch
        };
        
        mockEnv = {
            SKYBLUR_DO: {
                idFromName: vi.fn().mockReturnValue('mock-id'),
                get: vi.fn().mockReturnValue(mockStub)
            }
        };
    });

    describe('Security: forceRefresh=true behavior', () => {
        it('should bypass cache when forceRefresh=true', async () => {
            const mockDidDocument = {
                id: 'did:example:user',
                verificationMethod: [{
                    id: 'did:example:user#key-1',
                    type: 'JsonWebKey2020',
                    controller: 'did:example:user',
                    publicKeyJwk: { kty: 'EC', crv: 'P-256', x: 'new', y: 'key' }
                }]
            };

            // Mock cache GET to return stale data
            mockFetch.mockImplementation((req: Request) => {
                if (req.method === 'GET') {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            document: {
                                id: 'did:example:user',
                                verificationMethod: [{
                                    id: 'did:example:user#key-old',
                                    type: 'JsonWebKey2020',
                                    controller: 'did:example:user',
                                    publicKeyJwk: { kty: 'EC', crv: 'P-256', x: 'old', y: 'key' }
                                }]
                            },
                            cachedAt: Date.now() - 1000 // Fresh cache (1 second old)
                        })
                    });
                }
                // PUT request
                return Promise.resolve({ ok: true });
            });

            // Mock resolver to return fresh document
            const resolveSpy = vi.spyOn(resolverInstance, 'resolve').mockResolvedValue({
                didDocument: mockDidDocument,
                didDocumentMetadata: {},
                didResolutionMetadata: {}
            });

            const resolver = createCachedResolver(mockEnv, true);
            const result = await resolver.resolve('did:example:user');

            // SECURITY ASSERTION: Must resolve fresh, not use cache
            expect(resolveSpy).toHaveBeenCalledWith('did:example:user');
            expect(result.didDocument).toEqual(mockDidDocument);
            expect(result.didDocument?.verificationMethod?.[0].publicKeyJwk.x).toBe('new');

            resolveSpy.mockRestore();
        });

        it('should always resolve fresh even with valid cache when forceRefresh=true', async () => {
            const freshDocument = {
                id: 'did:example:user',
                verificationMethod: [{
                    id: 'did:example:user#current-key',
                    type: 'JsonWebKey2020',
                    controller: 'did:example:user',
                    publicKeyJwk: { kty: 'EC', crv: 'P-256', x: 'current', y: 'key' }
                }]
            };

            // Mock cache with valid (non-expired) data
            mockFetch.mockImplementation((req: Request) => {
                if (req.method === 'GET') {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            document: {
                                id: 'did:example:user',
                                verificationMethod: [{
                                    id: 'did:example:user#stale-key',
                                    publicKeyJwk: { x: 'stale' }
                                }]
                            },
                            cachedAt: Date.now() - 60000 // 1 minute old, well within 24h TTL
                        })
                    });
                }
                return Promise.resolve({ ok: true });
            });

            const resolveSpy = vi.spyOn(resolverInstance, 'resolve').mockResolvedValue({
                didDocument: freshDocument,
                didDocumentMetadata: {},
                didResolutionMetadata: {}
            });

            const resolver = createCachedResolver(mockEnv, true);
            const result = await resolver.resolve('did:example:user');

            // SECURITY ASSERTION: Must NOT use cache, even though it's valid
            expect(resolveSpy).toHaveBeenCalled();
            expect(result.didDocument?.verificationMethod?.[0].publicKeyJwk.x).toBe('current');

            resolveSpy.mockRestore();
        });

        it('should update cache after fresh resolution', async () => {
            const freshDocument = {
                id: 'did:example:user',
                verificationMethod: [{ id: 'did:example:user#key-1' }]
            };

            mockFetch.mockResolvedValue({ ok: true });

            const resolveSpy = vi.spyOn(resolverInstance, 'resolve').mockResolvedValue({
                didDocument: freshDocument,
                didDocumentMetadata: {},
                didResolutionMetadata: {}
            });

            const resolver = createCachedResolver(mockEnv, true);
            await resolver.resolve('did:example:user');

            // SECURITY ASSERTION: Fresh document should be written to cache
            const putCalls = mockFetch.mock.calls.filter((call: any) => {
                const req = call[0] as Request;
                return req.method === 'PUT';
            });
            
            expect(putCalls.length).toBeGreaterThan(0);
            const putReq = putCalls[0][0] as Request;
            // URL will be encoded, so check for the encoded version
            expect(putReq.url).toContain('diddoc_did%3Aexample%3Auser');

            resolveSpy.mockRestore();
        });
    });

    describe('Security: Per-resolver memoization', () => {
        it('should memoize forced resolutions within the same resolver instance', async () => {
            const mockDocument = {
                id: 'did:example:user',
                verificationMethod: [{ id: 'did:example:user#key-1' }]
            };

            mockFetch.mockResolvedValue({ ok: true });

            const resolveSpy = vi.spyOn(resolverInstance, 'resolve').mockResolvedValue({
                didDocument: mockDocument,
                didDocumentMetadata: {},
                didResolutionMetadata: {}
            });

            const resolver = createCachedResolver(mockEnv, true);
            
            // Resolve the same DID multiple times
            const result1 = await resolver.resolve('did:example:user');
            const result2 = await resolver.resolve('did:example:user');
            const result3 = await resolver.resolve('did:example:user');

            // SECURITY ASSERTION: Should only resolve once, then memoize
            expect(resolveSpy).toHaveBeenCalledTimes(1);
            expect(result1.didDocument).toEqual(mockDocument);
            expect(result2.didDocument).toEqual(mockDocument);
            expect(result3.didDocument).toEqual(mockDocument);

            resolveSpy.mockRestore();
        });

        it('should memoize per DID independently', async () => {
            const mockDoc1 = { id: 'did:example:user1', verificationMethod: [] };
            const mockDoc2 = { id: 'did:example:user2', verificationMethod: [] };

            mockFetch.mockResolvedValue({ ok: true });

            const resolveSpy = vi.spyOn(resolverInstance, 'resolve')
                .mockImplementation(async (did: string) => {
                    if (did === 'did:example:user1') {
                        return {
                            didDocument: mockDoc1,
                            didDocumentMetadata: {},
                            didResolutionMetadata: {}
                        };
                    }
                    return {
                        didDocument: mockDoc2,
                        didDocumentMetadata: {},
                        didResolutionMetadata: {}
                    };
                });

            const resolver = createCachedResolver(mockEnv, true);
            
            await resolver.resolve('did:example:user1');
            await resolver.resolve('did:example:user2');
            await resolver.resolve('did:example:user1'); // Should use memoized
            await resolver.resolve('did:example:user2'); // Should use memoized

            // SECURITY ASSERTION: Each DID resolved once, then memoized
            expect(resolveSpy).toHaveBeenCalledTimes(2);
            expect(resolveSpy).toHaveBeenCalledWith('did:example:user1');
            expect(resolveSpy).toHaveBeenCalledWith('did:example:user2');

            resolveSpy.mockRestore();
        });

        it('should handle concurrent resolution requests for the same DID', async () => {
            const mockDocument = {
                id: 'did:example:user',
                verificationMethod: [{ id: 'did:example:user#key-1' }]
            };

            mockFetch.mockResolvedValue({ ok: true });

            let resolveCount = 0;
            const resolveSpy = vi.spyOn(resolverInstance, 'resolve').mockImplementation(async () => {
                resolveCount++;
                // Simulate async delay
                await new Promise(resolve => setTimeout(resolve, 10));
                return {
                    didDocument: mockDocument,
                    didDocumentMetadata: {},
                    didResolutionMetadata: {}
                };
            });

            const resolver = createCachedResolver(mockEnv, true);
            
            // Fire multiple concurrent requests
            const promises = [
                resolver.resolve('did:example:user'),
                resolver.resolve('did:example:user'),
                resolver.resolve('did:example:user')
            ];

            const results = await Promise.all(promises);

            // SECURITY ASSERTION: Should only resolve once despite concurrent requests
            expect(resolveCount).toBe(1);
            expect(results[0].didDocument).toEqual(mockDocument);
            expect(results[1].didDocument).toEqual(mockDocument);
            expect(results[2].didDocument).toEqual(mockDocument);

            resolveSpy.mockRestore();
        });

        it('should clear memoization on resolution failure', async () => {
            mockFetch.mockResolvedValue({ ok: true });

            const resolveSpy = vi.spyOn(resolverInstance, 'resolve')
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce({
                    didDocument: { id: 'did:example:user' },
                    didDocumentMetadata: {},
                    didResolutionMetadata: {}
                });

            const resolver = createCachedResolver(mockEnv, true);
            
            // First attempt fails
            await expect(resolver.resolve('did:example:user')).rejects.toThrow('Network error');
            
            // Second attempt should retry (not use failed memoization)
            const result = await resolver.resolve('did:example:user');

            // SECURITY ASSERTION: Should retry after failure
            expect(resolveSpy).toHaveBeenCalledTimes(2);
            expect(result.didDocument?.id).toBe('did:example:user');

            resolveSpy.mockRestore();
        });
    });

    describe('Security: forceRefresh=false behavior (non-authentication)', () => {
        it('should use cache when forceRefresh=false and cache is valid', async () => {
            const cachedDocument = {
                id: 'did:example:user',
                verificationMethod: [{ id: 'did:example:user#cached-key' }]
            };

            mockFetch.mockImplementation((req: Request) => {
                if (req.method === 'GET') {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            document: cachedDocument,
                            cachedAt: Date.now() - 60000 // 1 minute old
                        })
                    });
                }
                return Promise.resolve({ ok: true });
            });

            const resolveSpy = vi.spyOn(resolverInstance, 'resolve');

            const resolver = createCachedResolver(mockEnv, false);
            const result = await resolver.resolve('did:example:user');

            // Should use cache, not resolve fresh
            expect(resolveSpy).not.toHaveBeenCalled();
            expect(result.didDocument).toEqual(cachedDocument);

            resolveSpy.mockRestore();
        });

        it('should resolve fresh when cache is expired (forceRefresh=false)', async () => {
            const freshDocument = {
                id: 'did:example:user',
                verificationMethod: [{ id: 'did:example:user#fresh-key' }]
            };

            mockFetch.mockImplementation((req: Request) => {
                if (req.method === 'GET') {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            document: { id: 'did:example:user' },
                            cachedAt: Date.now() - (25 * 60 * 60 * 1000) // 25 hours old (expired)
                        })
                    });
                }
                return Promise.resolve({ ok: true });
            });

            const resolveSpy = vi.spyOn(resolverInstance, 'resolve').mockResolvedValue({
                didDocument: freshDocument,
                didDocumentMetadata: {},
                didResolutionMetadata: {}
            });

            const resolver = createCachedResolver(mockEnv, false);
            const result = await resolver.resolve('did:example:user');

            // Should resolve fresh because cache expired
            expect(resolveSpy).toHaveBeenCalled();
            expect(result.didDocument).toEqual(freshDocument);

            resolveSpy.mockRestore();
        });
    });

    describe('Security: Rotated key scenario simulation', () => {
        it('should return fresh DID document without rotated key when forceRefresh=true', async () => {
            const staleDocWithOldKey = {
                id: 'did:example:user',
                verificationMethod: [
                    {
                        id: 'did:example:user#old-key',
                        type: 'JsonWebKey2020',
                        controller: 'did:example:user',
                        publicKeyJwk: { kty: 'EC', crv: 'P-256', x: 'old', y: 'key' }
                    }
                ]
            };

            const freshDocWithoutOldKey = {
                id: 'did:example:user',
                verificationMethod: [
                    {
                        id: 'did:example:user#new-key',
                        type: 'JsonWebKey2020',
                        controller: 'did:example:user',
                        publicKeyJwk: { kty: 'EC', crv: 'P-256', x: 'new', y: 'key' }
                    }
                ]
            };

            // Cache contains old key
            mockFetch.mockImplementation((req: Request) => {
                if (req.method === 'GET') {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            document: staleDocWithOldKey,
                            cachedAt: Date.now() - 60000 // Valid cache
                        })
                    });
                }
                return Promise.resolve({ ok: true });
            });

            // Authoritative resolver returns document without old key
            const resolveSpy = vi.spyOn(resolverInstance, 'resolve').mockResolvedValue({
                didDocument: freshDocWithoutOldKey,
                didDocumentMetadata: {},
                didResolutionMetadata: {}
            });

            const resolver = createCachedResolver(mockEnv, true);
            const result = await resolver.resolve('did:example:user');

            // SECURITY ASSERTION: Must return fresh document without old key
            expect(result.didDocument?.verificationMethod).toHaveLength(1);
            expect(result.didDocument?.verificationMethod?.[0].id).toBe('did:example:user#new-key');
            expect(result.didDocument?.verificationMethod?.[0].publicKeyJwk.x).toBe('new');

            // Old key should NOT be present
            const hasOldKey = result.didDocument?.verificationMethod?.some(
                (vm: any) => vm.id === 'did:example:user#old-key'
            );
            expect(hasOldKey).toBe(false);

            resolveSpy.mockRestore();
        });

        it('should prevent authentication with rotated key by returning fresh document', async () => {
            // Scenario: Key was rotated 30 minutes ago
            // Cache still has the old key (valid for 23.5 more hours)
            // But forceRefresh=true must return the current state without the old key

            const cachedDocWithRotatedKey = {
                id: 'did:plc:user123',
                verificationMethod: [
                    {
                        id: 'did:plc:user123#atproto',
                        type: 'Multikey',
                        controller: 'did:plc:user123',
                        publicKeyMultibase: 'zRotatedKey123'
                    }
                ]
            };

            const authoritativeDocWithoutRotatedKey = {
                id: 'did:plc:user123',
                verificationMethod: [
                    {
                        id: 'did:plc:user123#atproto',
                        type: 'Multikey',
                        controller: 'did:plc:user123',
                        publicKeyMultibase: 'zNewKey456'
                    }
                ]
            };

            mockFetch.mockImplementation((req: Request) => {
                if (req.method === 'GET') {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            document: cachedDocWithRotatedKey,
                            cachedAt: Date.now() - (30 * 60 * 1000) // 30 minutes ago
                        })
                    });
                }
                return Promise.resolve({ ok: true });
            });

            const resolveSpy = vi.spyOn(resolverInstance, 'resolve').mockResolvedValue({
                didDocument: authoritativeDocWithoutRotatedKey,
                didDocumentMetadata: {},
                didResolutionMetadata: {}
            });

            const resolver = createCachedResolver(mockEnv, true);
            const result = await resolver.resolve('did:plc:user123');

            // SECURITY ASSERTION: Must return authoritative document, not cached
            expect(result.didDocument?.verificationMethod?.[0].publicKeyMultibase).toBe('zNewKey456');
            expect(result.didDocument?.verificationMethod?.[0].publicKeyMultibase).not.toBe('zRotatedKey123');

            resolveSpy.mockRestore();
        });
    });

    describe('Security: Cache bypass verification', () => {
        it('should never read from cache when forceRefresh=true', async () => {
            const mockDocument = { id: 'did:example:user' };

            let getCalled = false;
            mockFetch.mockImplementation((req: Request) => {
                if (req.method === 'GET') {
                    getCalled = true;
                    return Promise.resolve({ ok: false });
                }
                return Promise.resolve({ ok: true });
            });

            const resolveSpy = vi.spyOn(resolverInstance, 'resolve').mockResolvedValue({
                didDocument: mockDocument,
                didDocumentMetadata: {},
                didResolutionMetadata: {}
            });

            const resolver = createCachedResolver(mockEnv, true);
            await resolver.resolve('did:example:user');

            // SECURITY ASSERTION: Should NOT attempt to read from cache
            expect(getCalled).toBe(false);

            resolveSpy.mockRestore();
        });

        it('should always call resolverInstance.resolve when forceRefresh=true', async () => {
            const mockDocument = { id: 'did:example:user' };

            mockFetch.mockResolvedValue({ ok: true });

            const resolveSpy = vi.spyOn(resolverInstance, 'resolve').mockResolvedValue({
                didDocument: mockDocument,
                didDocumentMetadata: {},
                didResolutionMetadata: {}
            });

            const resolver = createCachedResolver(mockEnv, true);
            await resolver.resolve('did:example:user');

            // SECURITY ASSERTION: Must always resolve fresh
            expect(resolveSpy).toHaveBeenCalledWith('did:example:user');

            resolveSpy.mockRestore();
        });
    });
});
