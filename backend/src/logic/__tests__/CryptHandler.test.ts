import { afterEach, describe, it, expect, vi } from 'vitest';
import { deriveKey, getDecrypt } from '../CryptHandler';

// Web Crypto API polyfill for Node environment if needed, 
// but Vitest with environment: 'node' (v20+) usually has global crypto.
// If not, we might need to verify if globalThis.crypto is available.

describe('CryptHandler', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });
    describe('deriveKey', () => {
        it('should derive a CryptoKey from password and salt', async () => {
            const password = 'my-secret-password';
            const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);

            const key = await deriveKey(password, salt);

            expect(key).toBeDefined();
            expect(key.algorithm.name).toBe('AES-GCM');
            // @ts-ignore
            expect(key.algorithm.length).toBe(256);
            expect(key.usages).toContain('encrypt');
            expect(key.usages).toContain('decrypt');
        });
    });

    describe('getDecrypt', () => {
        it.each(['https://morel.us-east.host.bsky.network', 'https://pds.example.com/'])(
          'decrypts data from a federated PDS: %s', async (pds) => {
            // Mock fetch to return a specific blob
            // First we need to construct a valid encrypted blob to test decryption against.
            // This is a bit complex as we need to replicate the encryption side which isn't exported in CryptHandler 
            // (it only has getDecrypt).

            // For the sake of this test, we will trust deriveKey works (tested above) and manually encrypt something.

            const password = 'test-password';
            const textToEncrypt = JSON.stringify({ text: 'Hello World', additional: 'Extra' });
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const iv = crypto.getRandomValues(new Uint8Array(12));

            const key = await deriveKey(password, salt);
            const encoder = new TextEncoder();
            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                key,
                encoder.encode(textToEncrypt)
            );

            const saltBase64 = btoa(String.fromCharCode(...salt));
            const ivBase64 = btoa(String.fromCharCode(...iv));
            const encryptedBase64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));

            const blobContent = `${ivBase64}:${saltBase64}:${encryptedBase64}`;

            // Mock global fetch
            const fetchMock = vi.fn().mockResolvedValue({
                ok: true,
                blob: async () => new Blob([blobContent])
            });
            vi.stubGlobal('fetch', fetchMock);

            const result = await getDecrypt(pds, 'did:example:repo', 'bafy...', password);

            expect(fetchMock).toHaveBeenCalledTimes(1);
            const url = new URL(fetchMock.mock.calls[0][0]);
            expect(url.origin).toBe(new URL(pds).origin);
            expect(url.pathname).toBe('/xrpc/com.atproto.sync.getBlob');
            expect(url.searchParams.get('did')).toBe('did:example:repo');
            expect(url.searchParams.get('cid')).toBe('bafy...');
            expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: 'manual', signal: expect.any(AbortSignal) });
            expect(result).toEqual({ text: 'Hello World', additional: 'Extra' });
        });

        it('should throw error if fetch fails', async () => {
            const fetchMock = vi.fn().mockResolvedValue({
                ok: false
            });
            vi.stubGlobal('fetch', fetchMock);

            await expect(getDecrypt('https://example.com', 'did:e', 'cid', 'pass'))
                .rejects.toThrow('Cannot get blob from https://example.com/');
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it.each([
            'https://127.0.0.1',
            'https://2130706433',
            'https://0x7f000001',
            'https://[::1]',
            'https://[::ffff:127.0.0.1]',
            'https://localhost.',
            'https://pds.internal',
            'http://pds.example.com',
            'https://user:pass@pds.example.com',
            'https://pds.example.com:8443',
            'https://pds.example.com?redirect=1',
            'https://pds.example.com#fragment',
            'ftp://example.com',
            'https://example.com/../private',
        ])('rejects an invalid blob URL before fetching: %s', async (pds) => {
            const fetchMock = vi.fn();
            vi.stubGlobal('fetch', fetchMock);

            await expect(getDecrypt(pds, 'did:e', 'cid', 'pass')).rejects.toThrow('Invalid URL');
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('does not follow a blob redirect to an internal destination', async () => {
            const fetchMock = vi.fn().mockResolvedValue(new Response(null, {
                status: 302, headers: { location: 'https://127.0.0.1/private' },
            }));
            vi.stubGlobal('fetch', fetchMock);
            await expect(getDecrypt('https://pds.example.com', 'did:e', 'cid', 'pass')).rejects.toThrow('Cannot get blob');
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock.mock.calls[0][1].redirect).toBe('manual');
        });
    });
});
