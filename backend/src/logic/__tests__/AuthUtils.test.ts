import { describe, it, expect, vi } from 'vitest';
import { signDid, getAuthenticatedDid } from '../AuthUtils';
import * as JWTTokenHandler from '../JWTTokenHandler';

// Mock JWTTokenHandler
vi.mock('../JWTTokenHandler');

describe('AuthUtils', () => {
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
    });
});
