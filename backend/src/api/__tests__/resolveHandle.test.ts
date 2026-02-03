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
    it('should return 502 if domain is unreachable', async () => {
        const c: any = {
            req: { url: 'https://api.example.com/resolve?handle=down.com' },
            json: vi.fn(),
        };
        global.fetch = vi.fn().mockResolvedValue({ ok: false });
        await handle(c);
        expect(c.json).toHaveBeenCalledWith({ error: 'Domain is unreachable' }, 502);
    });

    it('should return 500 on exception', async () => {
        const c: any = {
            req: { url: 'https://api.example.com/resolve?handle=err.com' },
            json: vi.fn(),
        };
        global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
        await handle(c);
        expect(c.json).toHaveBeenCalledWith({ error: 'Network error' }, 500);
    });

    it('should return 500 on unknown exception', async () => {
        const c: any = {
            req: { url: 'https://api.example.com/resolve?handle=unknown.com' },
            json: vi.fn(),
        };
        global.fetch = vi.fn().mockRejectedValue('unknown');
        await handle(c);
        expect(c.json).toHaveBeenCalledWith({ error: 'Unknown error' }, 500);
    });
});
