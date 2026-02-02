import { describe, it, expect, vi } from 'vitest';
import { handle } from '../resolveHandle';

describe('resolveHandle API', () => {
    it('should resolve handle to DID', async () => {
        const c: any = {
            req: {
                url: 'https://api.example.com/resolve?handle=user.bsky.social'
            },
            json: vi.fn(),
        };

        const mockDid = 'did:plc:123';
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => mockDid
        });

        await handle(c);

        expect(global.fetch).toHaveBeenCalledWith(expect.anything());
        // Verify fetch url involves handle
        const fetchUrl = (global.fetch as any).mock.calls[0][0];
        expect(fetchUrl.toString()).toContain('user.bsky.social');

        expect(c.json).toHaveBeenCalledWith({ did: mockDid });
    });

    it('should return error if handle is missing', async () => {
        const c: any = {
            req: { url: 'https://api.example.com/resolve' }, // no params
            json: vi.fn(),
        };

        await handle(c);
        expect(c.json).toHaveBeenCalledWith({ error: 'Missing handle' }, 400);
    });

    it('should return error for invalid DID format', async () => {
        const c: any = {
            req: { url: 'https://api.example.com/resolve?handle=bad.com' },
            json: vi.fn(),
        };

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => 'not-a-did'
        });

        await handle(c);
        expect(c.json).toHaveBeenCalledWith({ error: 'Invalid DID' }, 400);
    });
});
