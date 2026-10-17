import { beforeEach, describe, it, expect, vi } from 'vitest';
import { getAuthenticatedDid } from '../AuthUtils';
import * as JWTTokenHandler from '../JWTTokenHandler';

/**
 * Security Test Suite: Stale DID-document cache mitigation
 * 
 * Pentest Finding: "Stale DID-document cache permits authentication with a 
 * rotated signing key for up to 24 hours"
 * 
 * This test suite verifies that the mitigation is effective:
 * - JWT authentication MUST use forceRefresh=true to bypass stale cache
 * - A token signed with a rotated/revoked key MUST be rejected immediately
 * - The resolver MUST NOT trust cached DID documents for authentication
 */

// Mock JWTTokenHandler
vi.mock('../JWTTokenHandler');

describe('AuthUtils - Stale Cache Security Tests', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('Security: JWT authentication must always force-refresh DID documents', () => {
        it('should call createCachedResolver with forceRefresh=true when SKYBLUR_DO is available', async () => {
            const mockResolver = { resolve: vi.fn() };
            const createCachedResolverSpy = vi.spyOn(JWTTokenHandler, 'createCachedResolver')
                .mockReturnValue(mockResolver as any);

            const c: any = {
                req: {
                    header: vi.fn().mockReturnValue('Bearer valid-token'),
                    raw: { headers: new Headers() }
                },
                env: {
                    APPVIEW_HOST: 'app.example.com',
                    SKYBLUR_DO: { idFromName: vi.fn(), get: vi.fn() }
                }
            };

            // @ts-ignore
            JWTTokenHandler.verifyJWT.mockResolvedValue({
                verified: true,
                payload: { iss: 'did:example:user' }
            });

            await getAuthenticatedDid(c);

            // SECURITY ASSERTION: createCachedResolver MUST be called with forceRefresh=true
            expect(createCachedResolverSpy).toHaveBeenCalledWith(
                expect.objectContaining({ SKYBLUR_DO: expect.anything() }),
                true  // forceRefresh MUST be true for authentication
            );
        });

        it('should reject authentication when JWT verification fails with fresh resolver', async () => {
            const mockResolver = { resolve: vi.fn() };
            vi.spyOn(JWTTokenHandler, 'createCachedResolver')
                .mockReturnValue(mockResolver as any);

            const c: any = {
                req: {
                    header: vi.fn().mockReturnValue('Bearer token-with-rotated-key'),
                    raw: { headers: new Headers() }
                },
                env: {
                    APPVIEW_HOST: 'app.example.com',
                    SKYBLUR_DO: { idFromName: vi.fn(), get: vi.fn() }
                }
            };

            // Simulate JWT verification failure (e.g., key not found in fresh DID document)
            // @ts-ignore
            JWTTokenHandler.verifyJWT.mockRejectedValue(
                new Error('Signature verification failed: key not found in DID document')
            );

            const result = await getAuthenticatedDid(c);

            // SECURITY ASSERTION: Authentication MUST fail when verification fails
            expect(result).toBeNull();
        });

        it('should not fall back to stale cache after fresh verification fails', async () => {
            const mockResolver = { resolve: vi.fn() };
            const createCachedResolverSpy = vi.spyOn(JWTTokenHandler, 'createCachedResolver')
                .mockReturnValue(mockResolver as any);

            const c: any = {
                req: {
                    header: vi.fn().mockReturnValue('Bearer token-with-rotated-key'),
                    raw: { headers: new Headers() }
                },
                env: {
                    APPVIEW_HOST: 'app.example.com',
                    SKYBLUR_DO: { idFromName: vi.fn(), get: vi.fn() }
                }
            };

            // @ts-ignore
            JWTTokenHandler.verifyJWT.mockRejectedValue(
                new Error('Signature verification failed')
            );

            await getAuthenticatedDid(c);

            // SECURITY ASSERTION: createCachedResolver should only be called ONCE with forceRefresh=true
            // There should be NO second call with forceRefresh=false
            expect(createCachedResolverSpy).toHaveBeenCalledTimes(1);
            expect(createCachedResolverSpy).toHaveBeenCalledWith(
                expect.anything(),
                true  // Only forceRefresh=true call
            );
        });
    });

    describe('Security: Rotated signing key scenario', () => {
        it('should reject a newly minted JWT signed with a rotated key', async () => {
            const mockResolver = { resolve: vi.fn() };
            vi.spyOn(JWTTokenHandler, 'createCachedResolver')
                .mockReturnValue(mockResolver as any);

            const c: any = {
                req: {
                    header: vi.fn().mockReturnValue('Bearer fresh-jwt-with-old-key'),
                    raw: { headers: new Headers() }
                },
                env: {
                    APPVIEW_HOST: 'app.example.com',
                    SKYBLUR_DO: { idFromName: vi.fn(), get: vi.fn() }
                }
            };

            // Simulate the scenario:
            // - JWT is fresh (not expired, correct audience)
            // - But signed with a key that was rotated out of the authoritative DID document
            // - verifyJWT should fail because the key is not in the fresh DID document
            // @ts-ignore
            JWTTokenHandler.verifyJWT.mockRejectedValue(
                new Error('No matching key found in DID document')
            );

            const result = await getAuthenticatedDid(c);

            // SECURITY ASSERTION: Must reject the token even though it's otherwise valid
            expect(result).toBeNull();
        });

        it('should authenticate successfully only with current signing key', async () => {
            const mockResolver = { resolve: vi.fn() };
            vi.spyOn(JWTTokenHandler, 'createCachedResolver')
                .mockReturnValue(mockResolver as any);

            const c: any = {
                req: {
                    header: vi.fn().mockReturnValue('Bearer jwt-with-current-key'),
                    raw: { headers: new Headers() }
                },
                env: {
                    APPVIEW_HOST: 'app.example.com',
                    SKYBLUR_DO: { idFromName: vi.fn(), get: vi.fn() }
                }
            };

            // Simulate successful verification with current key from fresh DID document
            // @ts-ignore
            JWTTokenHandler.verifyJWT.mockResolvedValue({
                verified: true,
                payload: { iss: 'did:example:user' }
            });

            const result = await getAuthenticatedDid(c);

            // SECURITY ASSERTION: Authentication succeeds with current key
            expect(result).toBe('did:example:user');
        });
    });

    describe('Security: Multiple audience attempts with fresh resolver', () => {
        it('should use the same fresh resolver for all audience attempts', async () => {
            const mockResolver = { resolve: vi.fn() };
            const createCachedResolverSpy = vi.spyOn(JWTTokenHandler, 'createCachedResolver')
                .mockReturnValue(mockResolver as any);

            const c: any = {
                req: {
                    header: vi.fn().mockReturnValue('Bearer valid-token'),
                    raw: { headers: new Headers() }
                },
                env: {
                    APPVIEW_HOST: 'app.example.com',
                    APPVIEW_PROXY_HOSTS: 'preview.example.com, legacy.example.com',
                    SKYBLUR_DO: { idFromName: vi.fn(), get: vi.fn() }
                }
            };

            // First two audiences fail, third succeeds
            // @ts-ignore
            JWTTokenHandler.verifyJWT
                .mockRejectedValueOnce(new Error('Invalid audience'))
                .mockRejectedValueOnce(new Error('Invalid audience'))
                .mockResolvedValueOnce({
                    verified: true,
                    payload: { iss: 'did:example:user' }
                });

            await getAuthenticatedDid(c);

            // SECURITY ASSERTION: createCachedResolver called only once with forceRefresh=true
            expect(createCachedResolverSpy).toHaveBeenCalledTimes(1);
            expect(createCachedResolverSpy).toHaveBeenCalledWith(
                expect.anything(),
                true
            );

            // All verifyJWT calls should use the same fresh resolver
            expect(JWTTokenHandler.verifyJWT).toHaveBeenCalledTimes(3);
            expect(JWTTokenHandler.verifyJWT).toHaveBeenNthCalledWith(
                1,
                'Bearer valid-token',
                'did:web:app.example.com',
                mockResolver
            );
            expect(JWTTokenHandler.verifyJWT).toHaveBeenNthCalledWith(
                2,
                'Bearer valid-token',
                'did:web:preview.example.com',
                mockResolver
            );
            expect(JWTTokenHandler.verifyJWT).toHaveBeenNthCalledWith(
                3,
                'Bearer valid-token',
                'did:web:legacy.example.com',
                mockResolver
            );
        });
    });

    describe('Security: Authorization boundary enforcement', () => {
        it('should prevent access to restricted resources with rotated key', async () => {
            const mockResolver = { resolve: vi.fn() };
            vi.spyOn(JWTTokenHandler, 'createCachedResolver')
                .mockReturnValue(mockResolver as any);

            const c: any = {
                req: {
                    header: vi.fn().mockReturnValue('Bearer token-with-rotated-key'),
                    raw: { headers: new Headers() }
                },
                env: {
                    APPVIEW_HOST: 'app.example.com',
                    SKYBLUR_DO: { idFromName: vi.fn(), get: vi.fn() }
                }
            };

            // Simulate verification failure due to rotated key
            // @ts-ignore
            JWTTokenHandler.verifyJWT.mockRejectedValue(
                new Error('Key not in current DID document')
            );

            const authenticatedDid = await getAuthenticatedDid(c);

            // SECURITY ASSERTION: No DID is returned, preventing authorization
            expect(authenticatedDid).toBeNull();
            
            // This null result would prevent:
            // - Reading restricted posts (requesterDid === repo check fails)
            // - Writing to namespace (uri.startsWith check fails)
            // - Any other DID-based authorization
        });

        it('should allow access to restricted resources only with current key', async () => {
            const mockResolver = { resolve: vi.fn() };
            vi.spyOn(JWTTokenHandler, 'createCachedResolver')
                .mockReturnValue(mockResolver as any);

            const c: any = {
                req: {
                    header: vi.fn().mockReturnValue('Bearer token-with-current-key'),
                    raw: { headers: new Headers() }
                },
                env: {
                    APPVIEW_HOST: 'app.example.com',
                    SKYBLUR_DO: { idFromName: vi.fn(), get: vi.fn() }
                }
            };

            // @ts-ignore
            JWTTokenHandler.verifyJWT.mockResolvedValue({
                verified: true,
                payload: { iss: 'did:example:user' }
            });

            const authenticatedDid = await getAuthenticatedDid(c);

            // SECURITY ASSERTION: Valid DID returned for authorization checks
            expect(authenticatedDid).toBe('did:example:user');
        });
    });

    describe('Security: Regression prevention', () => {
        it('should never create a non-forced resolver for JWT authentication', async () => {
            const createCachedResolverSpy = vi.spyOn(JWTTokenHandler, 'createCachedResolver')
                .mockReturnValue({ resolve: vi.fn() } as any);

            const c: any = {
                req: {
                    header: vi.fn().mockReturnValue('Bearer any-token'),
                    raw: { headers: new Headers() }
                },
                env: {
                    APPVIEW_HOST: 'app.example.com',
                    SKYBLUR_DO: { idFromName: vi.fn(), get: vi.fn() }
                }
            };

            // @ts-ignore
            JWTTokenHandler.verifyJWT.mockRejectedValue(new Error('Any error'));

            await getAuthenticatedDid(c);

            // SECURITY ASSERTION: Verify no call was made with forceRefresh=false
            const calls = createCachedResolverSpy.mock.calls;
            for (const call of calls) {
                const forceRefreshArg = call[1];
                expect(forceRefreshArg).toBe(true);
            }
        });

        it('should not have a fallback refresh path after initial verification', async () => {
            const verifyJWTSpy = vi.spyOn(JWTTokenHandler, 'verifyJWT');
            vi.spyOn(JWTTokenHandler, 'createCachedResolver')
                .mockReturnValue({ resolve: vi.fn() } as any);

            const c: any = {
                req: {
                    header: vi.fn().mockReturnValue('Bearer token'),
                    raw: { headers: new Headers() }
                },
                env: {
                    APPVIEW_HOST: 'app.example.com',
                    SKYBLUR_DO: { idFromName: vi.fn(), get: vi.fn() }
                }
            };

            // @ts-ignore
            verifyJWTSpy.mockRejectedValue(new Error('Verification failed'));

            await getAuthenticatedDid(c);

            // SECURITY ASSERTION: verifyJWT should be called exactly once per audience
            // No retry with a different resolver
            expect(verifyJWTSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('Security: Cache window exploitation prevention', () => {
        it('should prevent exploitation within the 24-hour cache window', async () => {
            const mockResolver = { resolve: vi.fn() };
            vi.spyOn(JWTTokenHandler, 'createCachedResolver')
                .mockReturnValue(mockResolver as any);

            const c: any = {
                req: {
                    header: vi.fn().mockReturnValue('Bearer fresh-jwt-old-key'),
                    raw: { headers: new Headers() }
                },
                env: {
                    APPVIEW_HOST: 'app.example.com',
                    SKYBLUR_DO: { idFromName: vi.fn(), get: vi.fn() }
                }
            };

            // Scenario: Key was rotated 1 hour ago, but cache is still valid for 23 hours
            // The JWT is freshly minted (not expired) but uses the old key
            // With forceRefresh=true, the fresh DID document should not contain the old key
            // @ts-ignore
            JWTTokenHandler.verifyJWT.mockRejectedValue(
                new Error('Signature verification failed: key not in DID document')
            );

            const result = await getAuthenticatedDid(c);

            // SECURITY ASSERTION: Must reject immediately, not wait for cache expiry
            expect(result).toBeNull();
        });

        it('should enforce immediate revocation boundary', async () => {
            const mockResolver = { resolve: vi.fn() };
            const createCachedResolverSpy = vi.spyOn(JWTTokenHandler, 'createCachedResolver')
                .mockReturnValue(mockResolver as any);

            const c: any = {
                req: {
                    header: vi.fn().mockReturnValue('Bearer jwt-token'),
                    raw: { headers: new Headers() }
                },
                env: {
                    APPVIEW_HOST: 'app.example.com',
                    SKYBLUR_DO: { idFromName: vi.fn(), get: vi.fn() }
                }
            };

            // @ts-ignore
            JWTTokenHandler.verifyJWT.mockRejectedValue(new Error('Revoked key'));

            await getAuthenticatedDid(c);

            // SECURITY ASSERTION: forceRefresh=true ensures immediate revocation
            expect(createCachedResolverSpy).toHaveBeenCalledWith(
                expect.anything(),
                true  // Immediate fresh resolution, no cache delay
            );
        });
    });
});
