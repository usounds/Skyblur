import { beforeEach, describe, it, expect, vi } from 'vitest';
import { signDid, getAuthenticatedDid } from '../AuthUtils';
import * as JWTTokenHandler from '../JWTTokenHandler';

// Mock JWTTokenHandler
vi.mock('../JWTTokenHandler');
vi.mock('../ATPOauth', () => ({
    getOAuthClient: vi.fn(),
    getRequestOrigin: vi.fn(),
    restoreSession: vi.fn(),
}));
import * as ATPOauth from '../ATPOauth';

describe('AuthUtils', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        // @ts-ignore
        ATPOauth.getRequestOrigin.mockReturnValue('https://api.example.com');
        // @ts-ignore
        ATPOauth.getOAuthClient.mockResolvedValue({});
        // @ts-ignore
        ATPOauth.restoreSession.mockResolvedValue({});
    });

    describe('signDid', () => {
        it('should sign a DID correctly', async () => {
            const did = 'did:example:123';
            const secret = 'secret-key';
            const signed = await signDid(did, secret);

            expect(signed).toContain(did + '.');
            // We can't easily predict the exact signature without repeating the logic, 
            // but we can check format and stability execution.
        });
    });

    describe('getAuthenticatedDid', () => {
        it('should return DID from Authorization header if valid JWT', async () => {
            const c: any = {
                req: {
                    header: vi.fn().mockReturnValue('Bearer valid-token'),
                    raw: {
                        headers: new Headers()
                    }
                },
                env: {
                    APPVIEW_HOST: 'app.example.com'
                }
            };

            // Setup mock
            // @ts-ignore
            JWTTokenHandler.verifyJWT.mockResolvedValue({
                verified: true,
                payload: { iss: 'did:example:auth' }
            });

            const did = await getAuthenticatedDid(c);
            expect(did).toBe('did:example:auth');
            expect(JWTTokenHandler.verifyJWT).toHaveBeenCalledWith(
                'Bearer valid-token',
                'did:web:app.example.com'
            );
        });

        it('should fall back to proxy DID audiences from env', async () => {
            const c: any = {
                req: {
                    header: vi.fn().mockReturnValue('Bearer valid-token'),
                    raw: {
                        headers: new Headers()
                    }
                },
                env: {
                    APPVIEW_HOST: 'app.example.com',
                    APPVIEW_PROXY_HOSTS: 'preview.example.com, legacy.example.com'
                }
            };

            // @ts-ignore
            JWTTokenHandler.verifyJWT
                .mockRejectedValueOnce(new Error('Invalid audience'))
                .mockResolvedValueOnce({
                    verified: true,
                    payload: { iss: 'did:example:legacy' }
                });

            const did = await getAuthenticatedDid(c);
            expect(did).toBe('did:example:legacy');
            expect(JWTTokenHandler.verifyJWT).toHaveBeenNthCalledWith(
                1,
                'Bearer valid-token',
                'did:web:app.example.com'
            );
            expect(JWTTokenHandler.verifyJWT).toHaveBeenNthCalledWith(
                2,
                'Bearer valid-token',
                'did:web:preview.example.com'
            );
        });

        it('should only try APPVIEW_HOST and APPVIEW_PROXY_HOSTS audiences', async () => {
            const c: any = {
                req: {
                    header: vi.fn().mockReturnValue('Bearer valid-token'),
                    raw: {
                        headers: new Headers()
                    }
                },
                env: {
                    APPVIEW_HOST: 'skyblur.uk',
                    API_HOST: 'api.skyblur.uk',
                    APPVIEW_PROXY_HOSTS: 'preview.skyblur.uk'
                }
            };

            // @ts-ignore
            JWTTokenHandler.verifyJWT
                .mockRejectedValueOnce(new Error('Invalid audience'))
                .mockResolvedValueOnce({
                    verified: true,
                    payload: { iss: 'did:example:preview' }
                });

            const did = await getAuthenticatedDid(c);
            expect(did).toBe('did:example:preview');
            expect(JWTTokenHandler.verifyJWT).toHaveBeenNthCalledWith(
                1,
                'Bearer valid-token',
                'did:web:skyblur.uk'
            );
            expect(JWTTokenHandler.verifyJWT).toHaveBeenNthCalledWith(
                2,
                'Bearer valid-token',
                'did:web:preview.skyblur.uk'
            );
            expect(JWTTokenHandler.verifyJWT).toHaveBeenCalledTimes(2);
        });

        it('should handle JWT verification failure (silent fail)', async () => {
            const c: any = {
                req: {
                    header: vi.fn().mockReturnValue('Bearer invalid-token'),
                    raw: { headers: new Headers() }
                },
                env: { APPVIEW_HOST: 'app.example.com' }
            };
            // @ts-ignore
            JWTTokenHandler.verifyJWT.mockRejectedValue(new Error('Invalid token'));

            const did = await getAuthenticatedDid(c);
            expect(did).toBeNull();
        });

        it('should return null if JWT verified but payload missing DID', async () => {
            const c: any = {
                req: {
                    header: vi.fn().mockReturnValue('Bearer valid-token'),
                    raw: { headers: new Headers() }
                },
                env: { APPVIEW_HOST: 'app.example.com' }
            };
            // @ts-ignore
            JWTTokenHandler.verifyJWT.mockResolvedValue({
                verified: true,
                payload: {} // No iss, sub, etc
            });

            const did = await getAuthenticatedDid(c);
            expect(did).toBe(''); // Based on current implementation logic `... || ''`
        });

        it('should return DID from cookie if signature matches', async () => {
            const secret = 'secret-key';
            const storedDid = 'did:example:cookie';
            const signedDid = await signDid(storedDid, secret);

            const c: any = {
                req: {
                    header: vi.fn(),
                    raw: {
                        headers: new Headers({
                            'Cookie': `oauth_did=${signedDid}`
                        })
                    }
                },
                env: {
                    OAUTH_PRIVATE_KEY_JWK: secret,
                    APPVIEW_HOST: 'app.example.com'
                }
            };

            const did = await getAuthenticatedDid(c);
            expect(did).toBe(storedDid);
        });

        it('should reject a validly signed cookie when the OAuth session was revoked', async () => {
            const secret = 'secret-key';
            const signedDid = await signDid('did:example:revoked', secret);

            const c: any = {
                req: {
                    header: vi.fn(),
                    raw: { headers: new Headers({ 'Cookie': `oauth_did=${signedDid}` }) }
                },
                env: { OAUTH_PRIVATE_KEY_JWK: secret, APPVIEW_HOST: 'app.example.com' }
            };
            // @ts-ignore
            ATPOauth.restoreSession.mockRejectedValue(new Error('session was deleted'));

            const did = await getAuthenticatedDid(c);
            expect(did).toBeNull();
        });

        it('should reject a validly signed cookie when the OAuth session was explicitly revoked via logout', async () => {
            const secret = 'secret-key';
            const signedDid = await signDid('did:example:loggedout', secret);

            const c: any = {
                req: {
                    header: vi.fn(),
                    raw: { headers: new Headers({ 'Cookie': `oauth_did=${signedDid}` }) }
                },
                env: { OAUTH_PRIVATE_KEY_JWK: secret, APPVIEW_HOST: 'app.example.com' }
            };
            // Simulate the session being revoked (e.g., via oauth.revoke(did))
            // @ts-ignore
            ATPOauth.restoreSession.mockRejectedValue(new Error('Session not found'));

            const did = await getAuthenticatedDid(c);
            expect(did).toBeNull();
            // Verify that restoreSession was called to check session validity
            expect(ATPOauth.restoreSession).toHaveBeenCalledWith(expect.anything(), 'did:example:loggedout');
        });

        it('should reject a validly signed cookie when the OAuth session has expired', async () => {
            const secret = 'secret-key';
            const signedDid = await signDid('did:example:expired', secret);

            const c: any = {
                req: {
                    header: vi.fn(),
                    raw: { headers: new Headers({ 'Cookie': `oauth_did=${signedDid}` }) }
                },
                env: { OAUTH_PRIVATE_KEY_JWK: secret, APPVIEW_HOST: 'app.example.com' }
            };
            // Simulate an expired session
            // @ts-ignore
            ATPOauth.restoreSession.mockRejectedValue(new Error('Token expired'));

            const did = await getAuthenticatedDid(c);
            expect(did).toBeNull();
        });

        it('should accept a validly signed cookie when the OAuth session is still active', async () => {
            const secret = 'secret-key';
            const storedDid = 'did:example:active';
            const signedDid = await signDid(storedDid, secret);

            const c: any = {
                req: {
                    header: vi.fn(),
                    raw: { headers: new Headers({ 'Cookie': `oauth_did=${signedDid}` }) }
                },
                env: { OAUTH_PRIVATE_KEY_JWK: secret, APPVIEW_HOST: 'app.example.com' }
            };
            // Simulate a valid, active session
            // @ts-ignore
            ATPOauth.restoreSession.mockResolvedValue({ did: storedDid });

            const did = await getAuthenticatedDid(c);
            expect(did).toBe(storedDid);
            // Verify that restoreSession was called to validate the session
            expect(ATPOauth.restoreSession).toHaveBeenCalledWith(expect.anything(), storedDid);
        });

        it('should reject cookie fallback after JWT failure when session was revoked', async () => {
            const secret = 'secret-key';
            const signedDid = await signDid('did:example:revoked', secret);

            const c: any = {
                req: {
                    header: vi.fn().mockReturnValue('Bearer expired-jwt-token'),
                    raw: { headers: new Headers({ 'Cookie': `oauth_did=${signedDid}` }) }
                },
                env: { 
                    OAUTH_PRIVATE_KEY_JWK: secret, 
                    APPVIEW_HOST: 'app.example.com' 
                }
            };
            // JWT verification fails (e.g., expired token)
            // @ts-ignore
            JWTTokenHandler.verifyJWT.mockRejectedValue(new Error('JWT expired'));
            // Cookie HMAC is valid but session was revoked
            // @ts-ignore
            ATPOauth.restoreSession.mockRejectedValue(new Error('session was deleted'));

            const did = await getAuthenticatedDid(c);
            // Should reject authentication entirely, not fall back to revoked cookie
            expect(did).toBeNull();
        });

        it('should prevent replay of copied cookie after server-side revocation', async () => {
            const secret = 'secret-key';
            const victimDid = 'did:example:victim';
            const signedDid = await signDid(victimDid, secret);

            // Scenario: Attacker copied the cookie before victim logged out
            // Victim logs out, which calls oauth.revoke(did)
            // Attacker tries to replay the copied cookie
            const c: any = {
                req: {
                    header: vi.fn(),
                    raw: { headers: new Headers({ 'Cookie': `oauth_did=${signedDid}` }) }
                },
                env: { OAUTH_PRIVATE_KEY_JWK: secret, APPVIEW_HOST: 'app.example.com' }
            };
            // The session was revoked server-side, so restoreSession fails
            // @ts-ignore
            ATPOauth.restoreSession.mockRejectedValue(new Error('Session not found'));

            const did = await getAuthenticatedDid(c);
            // The cookie replay should be rejected
            expect(did).toBeNull();
            // Verify that the session validity was checked
            expect(ATPOauth.restoreSession).toHaveBeenCalledWith(expect.anything(), victimDid);
        });

        it('should verify OAuth session state for cookie auth even with valid HMAC signature', async () => {
            const secret = 'secret-key';
            const testDid = 'did:example:test';
            const signedDid = await signDid(testDid, secret);

            const c: any = {
                req: {
                    header: vi.fn(),
                    raw: { headers: new Headers({ 'Cookie': `oauth_did=${signedDid}` }) }
                },
                env: { OAUTH_PRIVATE_KEY_JWK: secret, APPVIEW_HOST: 'app.example.com' }
            };
            
            // Mock restoreSession to succeed
            // @ts-ignore
            ATPOauth.restoreSession.mockResolvedValue({ did: testDid });

            const did = await getAuthenticatedDid(c);
            
            // Should succeed because both HMAC and session are valid
            expect(did).toBe(testDid);
            // Critical: verify that restoreSession was called (the security fix)
            expect(ATPOauth.restoreSession).toHaveBeenCalled();
            expect(ATPOauth.getOAuthClient).toHaveBeenCalled();
            expect(ATPOauth.getRequestOrigin).toHaveBeenCalled();
        });

        it('should return DID from cookie for did:web identifiers that include dots', async () => {
            const secret = 'secret-key';
            const storedDid = 'did:web:app.example.com';
            const signedDid = await signDid(storedDid, secret);

            const c: any = {
                req: {
                    header: vi.fn(),
                    raw: {
                        headers: new Headers({
                            'Cookie': `oauth_did=${signedDid}`
                        })
                    }
                },
                env: {
                    OAUTH_PRIVATE_KEY_JWK: secret,
                    APPVIEW_HOST: 'app.example.com'
                }
            };

            const did = await getAuthenticatedDid(c);
            expect(did).toBe(storedDid);
        });

        it('should return null if cookie has invalid format', async () => {
            const c: any = {
                req: {
                    header: vi.fn(),
                    raw: { headers: new Headers({ 'Cookie': 'oauth_did=invalid-format' }) }
                },
                env: { OAUTH_PRIVATE_KEY_JWK: 's' }
            };
            const did = await getAuthenticatedDid(c);
            expect(did).toBeNull();
        });

        it('should return null if cookie signature mismatch', async () => {
            const secret = 'secret-key';
            const wrongSecret = 'wrong-key';
            const storedDid = 'did:example:cookie';
            const signedDid = await signDid(storedDid, wrongSecret); // Signed with wrong key

            const c: any = {
                req: {
                    header: vi.fn(),
                    raw: { headers: new Headers({ 'Cookie': `oauth_did=${signedDid}` }) }
                },
                env: { OAUTH_PRIVATE_KEY_JWK: secret }
            };

            const did = await getAuthenticatedDid(c);
            expect(did).toBeNull();
        });

        it('should reject cookie authentication when the signing secret is missing', async () => {
            const storedDid = 'did:example:forged';
            const signedDid = await signDid(storedDid, 'default-fallback');

            const c: any = {
                req: {
                    header: vi.fn(),
                    raw: { headers: new Headers({ 'Cookie': `oauth_did=${signedDid}` }) }
                },
                env: {}
            };

            const did = await getAuthenticatedDid(c);
            expect(did).toBeNull();
        });

        it('should not fall back to a forged cookie after JWT verification fails without a signing secret', async () => {
            const storedDid = 'did:example:forged';
            const signedDid = await signDid(storedDid, 'default-fallback');

            const c: any = {
                req: {
                    header: vi.fn().mockReturnValue('Bearer invalid-token'),
                    raw: { headers: new Headers({ 'Cookie': `oauth_did=${signedDid}` }) }
                },
                env: { APPVIEW_HOST: 'app.example.com' }
            };
            // @ts-ignore
            JWTTokenHandler.verifyJWT.mockRejectedValue(new Error('Invalid token'));

            const did = await getAuthenticatedDid(c);
            expect(did).toBeNull();
        });
    });
});
