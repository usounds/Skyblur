import { describe, it, expect, vi } from 'vitest';
import { handle } from '../ecnrypt';
import * as AuthUtils from '@/logic/AuthUtils';
import * as CryptHandler from '@/logic/CryptHandler';

vi.mock('@/logic/AuthUtils');
vi.mock('@/logic/CryptHandler');

describe('encrypt API', () => {
    it('should encrypt body if authenticated', async () => {
        const c: any = {
            req: {
                json: vi.fn().mockResolvedValue({ body: 'secret text', password: 'pass' })
            },
            json: vi.fn()
        };

        // @ts-ignore
        AuthUtils.getAuthenticatedDid.mockResolvedValue('did:example:user');

        // Generate real key
        const realKey = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );

        // Mock deriveKey to return real key
        // @ts-ignore
        CryptHandler.deriveKey.mockResolvedValue(realKey);

        await handle(c);

        // Since we use real crypto for encryption inside api/ecnrypt.ts (not delegated purely to helper),
        // we check if it returned a JSON with 'body' string.
        expect(c.json).toHaveBeenCalledWith({ body: expect.any(String) });
    });

    it('should return 401 if not authenticated', async () => {
        const c: any = {
            req: {
                json: vi.fn().mockResolvedValue({ body: 's', password: 'p' })
            },
            json: vi.fn()
        };
        // @ts-ignore
        AuthUtils.getAuthenticatedDid.mockResolvedValue(null);
        await handle(c);
        expect(c.json).toHaveBeenCalledWith(expect.anything(), 401);
    });
});
