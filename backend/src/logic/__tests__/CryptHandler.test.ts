import { describe, it, expect, vi } from 'vitest';
import { deriveKey, getDecrypt } from '../CryptHandler';

// Web Crypto API polyfill for Node environment if needed, 
// but Vitest with environment: 'node' (v20+) usually has global crypto.
// If not, we might need to verify if globalThis.crypto is available.

describe('CryptHandler', () => {
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
        it('should decrypt data correctly', async () => {
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
            global.fetch = fetchMock;

            const result = await getDecrypt('https://pds.example.com', 'did:example:repo', 'bafy...', password);

            expect(fetchMock).toHaveBeenCalledWith('https://pds.example.com/xrpc/com.atproto.sync.getBlob?did=did:example:repo&cid=bafy...');
            expect(result).toEqual({ text: 'Hello World', additional: 'Extra' });
        });

        it('should throw error if fetch fails', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: false
            });

            await expect(getDecrypt('https://pds.example', 'did:e', 'cid', 'pass'))
                .rejects.toThrow('Cannot get blob');
        });
    });
});
