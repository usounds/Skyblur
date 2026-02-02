import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { restoreSession, getOAuthClient, clearSessionCache, getRequestOrigin } from '../ATPOauth';
import { OAuthClient } from '@atcute/oauth-node-client';

vi.mock('@atcute/oauth-node-client', async () => {
    const actual = await vi.importActual('@atcute/oauth-node-client');
    return {
        ...actual,
        OAuthClient: vi.fn(function (this: any, args: any) {
            this.metadata = args.metadata;
            this.stores = args.stores;
            this.restore = vi.fn();
            this.requestLock = vi.fn();
            return this;
        }),
    };
});

// Mock Global Crypto if needed (Vitest usually provides recent Node crypto)
// But ATPOauth uses global `crypto`

describe('ATPOauth', () => {
    let mockDOFetch: any;
    let mockDONamespace: any;
    let env: any;

    beforeEach(() => {
        vi.resetAllMocks();

        mockDOFetch = vi.fn();
        mockDONamespace = {
            idFromName: vi.fn().mockReturnValue('do-id'),
            get: vi.fn().mockReturnValue({ fetch: mockDOFetch })
        };

        env = {
            SKYBLUR_DO: mockDONamespace,
            APPVIEW_HOST: 'appview.example.com',
            DATA_ENCRYPTION_KEY: 'base64key', // Needs to be valid base64 for key import if we test real crypto
            OAUTH_PRIVATE_KEY_JWK: JSON.stringify({ kty: 'EC', x: 'x', y: 'y', crv: 'P-256' })
        };

        // Setup valid key for test
        // 32 bytes key base64 encoded
        const key = new Uint8Array(32).fill(1);
        env.DATA_ENCRYPTION_KEY = btoa(String.fromCharCode(...key));

    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getOAuthClient & DurableObjectStore', () => {
        it('should initialize client and stores correctly', async () => {
            const origin = 'https://api.example.com/init';
            await getOAuthClient(env, origin);

            expect(OAuthClient).toHaveBeenCalled();
            // @ts-ignore
            const args = OAuthClient.mock.calls[0][0];
            expect(args.metadata.client_id).toContain(origin);
            expect(args.stores).toBeDefined();
            expect(args.stores.sessions).toBeDefined();
            expect(args.stores.states).toBeDefined();
        });

        it('should perform GET operations on the store', async () => {
            const origin = 'https://api.example.com/get';
            await getOAuthClient(env, origin);
            // @ts-ignore
            const store = OAuthClient.mock.calls[0][0].stores.sessions;

            // Mock DO 404
            mockDOFetch.mockResolvedValueOnce({ status: 404 });
            const result404 = await store.get('missing');
            expect(result404).toBeUndefined();

            // Mock DO 200 Plain
            mockDOFetch.mockResolvedValueOnce({
                status: 200,
                json: async () => ({ foo: 'bar' })
            });
            const result200 = await store.get('exist');
            expect(result200).toEqual({ foo: 'bar' });

            expect(mockDOFetch).toHaveBeenCalledTimes(2);
        });

        it('should perform SET operations with encryption', async () => {
            const origin = 'https://api.example.com/set';
            await getOAuthClient(env, origin);
            // @ts-ignore
            const store = OAuthClient.mock.calls[0][0].stores.sessions;

            mockDOFetch.mockResolvedValue({ ok: true });

            await store.set('key', { secret: 'value' });

            expect(mockDOFetch).toHaveBeenCalledWith(
                expect.stringContaining('http://do/?key='),
                expect.objectContaining({ method: 'PUT', body: expect.any(String) })
            );

            // Check if body is stringified json with __encrypted
            const call = mockDOFetch.mock.calls[0];
            const body = JSON.parse(call[1].body);
            expect(body).toHaveProperty('__encrypted', true);
        });

        it('should perform DELETE operations', async () => {
            const origin = 'https://api.example.com/delete';
            await getOAuthClient(env, origin);
            // @ts-ignore
            const store = OAuthClient.mock.calls[0][0].stores.sessions;

            mockDOFetch.mockResolvedValue({ ok: true });

            await store.delete('key');

            expect(mockDOFetch).toHaveBeenCalledWith(
                expect.stringContaining('http://do/?key='),
                expect.objectContaining({ method: 'DELETE' })
            );
        });
    });

    describe('requestLock', () => {
        it('should acquire lock, run function, and unlock', async () => {
            const origin = 'https://api.example.com/lock';
            await getOAuthClient(env, origin);
            // @ts-ignore
            const requestLock = OAuthClient.mock.calls.find(c => c[0].metadata.client_id.includes(origin))[0].requestLock;

            // Mock Lock Success
            mockDOFetch.mockResolvedValue({ ok: true });

            const fn = vi.fn().mockResolvedValue('result');
            const result = await requestLock('test-lock', fn);

            expect(result).toBe('result');
            expect(fn).toHaveBeenCalled();
            // Check lock call
            expect(mockDOFetch).toHaveBeenCalledWith(
                expect.stringContaining('/lock?key='),
                expect.objectContaining({ method: 'POST' })
            );
            // Check unlock call
            expect(mockDOFetch).toHaveBeenCalledWith(
                expect.stringContaining('/unlock?key='),
                expect.objectContaining({ method: 'POST' })
            );
        });

        it('should retry on 423 and then succeed', async () => {
            const origin = 'https://api.example.com/lock-retry';
            await getOAuthClient(env, origin);
            // @ts-ignore
            const requestLock = OAuthClient.mock.calls.find(c => c[0].metadata.client_id.includes(origin))[0].requestLock;

            mockDOFetch
                .mockResolvedValueOnce({ status: 423, statusText: 'Locked' }) // Fail 1
                .mockResolvedValueOnce({ ok: true }) // Success 2
                .mockResolvedValueOnce({ ok: true }); // Unlock

            const fn = vi.fn().mockResolvedValue('result');
            const result = await requestLock('test-lock', fn);

            expect(result).toBe('result');
            expect(mockDOFetch).toHaveBeenCalledTimes(3);
        });

        it('should fail if lock cannot be acquired after retries', async () => {
            const origin = 'https://api.example.com/lock-fail';
            await getOAuthClient(env, origin);
            // @ts-ignore
            const requestLock = OAuthClient.mock.calls.find(c => c[0].metadata.client_id.includes(origin))[0].requestLock;

            // Mock Fail always
            // We need to limit the loop or mock many times. 
            // The code has maxAttempts = 20.
            mockDOFetch.mockResolvedValue({ status: 423, statusText: 'Locked' });

            // Speed up retry wait
            const realSetTimeout = global.setTimeout;
            // @ts-ignore
            global.setTimeout = (fn: any) => fn();

            try {
                await expect(requestLock('test-lock', vi.fn())).rejects.toThrow('Lock acquisition timed out');
            } finally {
                global.setTimeout = realSetTimeout;
            }
        });
    });

    describe('DurableObjectStore Extended', () => {
        it('should handle Uint8Array in replace/revive', async () => {
            const origin = 'https://api.example.com/uint8';
            await getOAuthClient(env, origin);
            // @ts-ignore
            const store = OAuthClient.mock.calls.find(c => c[0].metadata.client_id.includes(origin))[0].stores.sessions;

            const data = { buffer: new Uint8Array([1, 2, 3]) };

            // SET
            mockDOFetch.mockResolvedValue({ ok: true });
            await store.set('uint8', data);

            // Check if data was transformed
            const putCall = mockDOFetch.mock.lastCall;
            const putBody = JSON.parse(putCall[1].body);
            // Since encryption is on by default in mock env, we need to decrypt to check payload OR disable encryption
            // Disabling encryption for this test case might be easier to verify payload structure

            // GET
            // Mock return with transformation
            const storedData = { buffer: { __type: 'Uint8Array', data: [1, 2, 3] } };
            // Use mocked encryption response if encryption is active... 
            // Let's rely on internal methods being called.

            // To properly test revive, we need to simulate the fetch return matching what 'replace' produced.
            // But 'replace' logic is wrapped in 'set' and 'encrypt'.

            // Let's try to verify via round trip if possible, allowing store itself to encrypt/decrypt.
            // We need 'get' to return the encrypted blob that 'set' produced.

            // Capture what was set
            const encryptedBody = putBody;

            mockDOFetch.mockResolvedValue({
                status: 200,
                json: async () => encryptedBody
            });

            const retrieved = await store.get('uint8');
            expect(retrieved).toEqual(data);
            expect(retrieved.buffer).toBeInstanceOf(Uint8Array);
        });
    });

    describe('restoreSession', () => {
        it('should restore session using oauth client', async () => {
            const mockSession = { did: 'did:example:123' };
            const oauthClientMock = {
                restore: vi.fn().mockResolvedValue(mockSession)
            };

            const did = 'did:unique:test:' + Date.now(); // Ensure unique
            const session = await restoreSession(oauthClientMock as any, did);

            expect(oauthClientMock.restore).toHaveBeenCalledWith(did);
            expect(session).toEqual(mockSession);
        });

        it('should return cached session if available', async () => {
            const mockSession = { did: 'did:cached:123' };
            const oauthClientMock = {
                restore: vi.fn().mockResolvedValue(mockSession)
            };
            const did = 'did:cached:' + Date.now();

            // First call - cache it
            await restoreSession(oauthClientMock as any, did);

            // Second call - should use cache
            oauthClientMock.restore.mockClear();
            const session2 = await restoreSession(oauthClientMock as any, did);

            expect(oauthClientMock.restore).not.toHaveBeenCalled();
            expect(session2).toEqual(mockSession);
        });

        it('should handle TokenRefreshError', async () => {
            const oauthClientMock = {
                restore: vi.fn().mockRejectedValue({ name: 'TokenRefreshError', message: 'session was deleted' })
            };
            const did = 'did:fail';
            await expect(restoreSession(oauthClientMock as any, did)).rejects.toHaveProperty('name', 'TokenRefreshError');
        });
    });

    describe('getRequestOrigin', () => {
        it('should return valid origin', () => {
            const req = new Request('https://host.com/path');
            // @ts-ignore
            const origin = getRequestOrigin(req, {});
            expect(origin).toBe('https://host.com');
        });

        it('should prefer env.API_HOST', () => {
            const req = new Request('https://host.com/path');
            // @ts-ignore
            const origin = getRequestOrigin(req, { API_HOST: 'api.custom.com' });
            expect(origin).toBe('https://api.custom.com');
        });
    });

    describe('safeFetch', () => {
        it('should transform redirect: error to manual', async () => {
            const origin = 'https://api.example.com/safefetch';
            await getOAuthClient(env, origin);
            // @ts-ignore
            const safeFetch: any = OAuthClient.mock.calls.find(c => c[0].metadata.client_id.includes(origin))[0].fetch;

            // Mock global fetch for this scope
            const originalFetch = global.fetch;
            const mockFetchInstance = vi.fn().mockResolvedValue('fetched');
            global.fetch = mockFetchInstance;

            try {
                await safeFetch('http://url', { redirect: 'error', cache: 'force-cache' });

                expect(mockFetchInstance).toHaveBeenCalledWith('http://url', expect.objectContaining({
                    redirect: 'manual'
                }));
                // Cache should be removed if not default
                const callArgs = mockFetchInstance.mock.calls[0][1];
                expect(callArgs.cache).toBeUndefined();

            } finally {
                global.fetch = originalFetch;
            }
        });
    });

    describe('requestLock error handling', () => {
        it('should throw immediately on non-423 error', async () => {
            const origin = 'https://api.example.com/lock-error';
            await getOAuthClient(env, origin);
            // @ts-ignore
            const requestLock = OAuthClient.mock.calls.find(c => c[0].metadata.client_id.includes(origin))[0].requestLock;

            mockDOFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Error' });

            await expect(requestLock('test', vi.fn())).rejects.toThrow('Failed to acquire lock: 500 Internal Error');
        });
    });

    describe('DurableObjectStore Error Handling', () => {
        it('should handle encryption failure', async () => {
            const origin = 'https://api.example.com/enc-fail';
            await getOAuthClient(env, origin);
            // @ts-ignore
            const store = OAuthClient.mock.calls.find(c => c[0].metadata.client_id.includes(origin))[0].stores.sessions;

            // Mock encrypt to fail
            const spyEncrypt = vi.spyOn(crypto.subtle, 'encrypt').mockRejectedValue(new Error('Encrypt fail'));

            try {
                await expect(store.set('key', { data: 'v' })).rejects.toThrow('Encrypt fail');
            } finally {
                spyEncrypt.mockRestore();
            }
        });

        it('should return undefined if decryption fails', async () => {
            const origin = 'https://api.example.com/dec-fail';
            await getOAuthClient(env, origin);
            // @ts-ignore
            const store = OAuthClient.mock.calls.find(c => c[0].metadata.client_id.includes(origin))[0].stores.sessions;

            mockDOFetch.mockResolvedValue({
                status: 200,
                json: async () => ({ __encrypted: true, iv: 'bad', data: 'bad' })
            });

            // Mock decrypt to fail
            const spyDecrypt = vi.spyOn(crypto.subtle, 'decrypt').mockRejectedValue(new Error('Decrypt fail'));

            try {
                const res = await store.get('key');
                expect(res).toBeUndefined();
            } finally {
                spyDecrypt.mockRestore();
            }
        });
    });
});
