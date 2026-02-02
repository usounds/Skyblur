import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handle } from '../DidDocCache';
import { Resolver } from 'did-resolver';

vi.mock('did-resolver');
vi.mock('@/logic/DidPlcResolver', () => ({ getResolver: vi.fn().mockReturnValue({}) }));
vi.mock('web-did-resolver', () => ({ getResolver: vi.fn().mockReturnValue({}) }));

describe('DidDocCache API', () => {
    let mockFetch: any;
    let mockResolve: any;
    let mockWaitUntil: any;

    beforeEach(() => {
        vi.resetAllMocks();
        mockFetch = vi.fn();
        mockResolve = vi.fn();
        mockWaitUntil = vi.fn();

        // @ts-ignore
        Resolver.mockImplementation(function () {
            return { resolve: mockResolve };
        });
    });

    const createCtx = (params: any, env: any = {}) => {
        const query = (k: string) => params[k] !== undefined ? params[k] : null;
        return {
            req: { query },
            json: vi.fn(),
            env,
            executionCtx: { waitUntil: mockWaitUntil }
        } as any;
    };

    const mockEnv = () => ({
        SKYBLUR_DO: {
            idFromName: vi.fn().mockReturnValue('do-id'),
            get: vi.fn().mockReturnValue({ fetch: mockFetch })
        }
    });

    it('should return 400 if did is missing', async () => {
        const c = createCtx({ forceRefresh: 'false' }); // did undefined -> null
        await handle(c);
        expect(c.json).toHaveBeenCalledWith({ error: 'Missing did parameter' }, 400);
    });

    it('should return 400 if forceRefresh is missing', async () => {
        const c = createCtx({ actor: 'did:test' }); // forceRefresh undefined -> null
        await handle(c);
        expect(c.json).toHaveBeenCalledWith({ error: 'Missing forceRefresh parameter' }, 400);
    });

    it('should return 500 if DO binding is missing', async () => {
        const c = createCtx({ actor: 'did:test', forceRefresh: 'false' }, {});
        await handle(c);
        expect(c.json).toHaveBeenCalledWith({ error: 'DO binding not found' }, 500);
    });

    it('should return cached document if available and not forced refresh', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ id: 'did:cached' })
        });
        const c = createCtx({ actor: 'did:test', forceRefresh: 'false' }, mockEnv());

        await handle(c);

        expect(mockFetch).toHaveBeenCalled();
        expect(c.json).toHaveBeenCalledWith({ id: 'did:cached' });
        expect(mockResolve).not.toHaveBeenCalled();
    });

    it('should resolve and cache if cache miss', async () => {
        // Cache miss
        mockFetch.mockResolvedValue({ ok: false });
        // Resolve success
        mockResolve.mockResolvedValue({ didDocument: { id: 'did:resolved' } });

        const c = createCtx({ actor: 'did:test', forceRefresh: 'false' }, mockEnv());

        await handle(c);

        expect(mockResolve).toHaveBeenCalledWith('did:test');
        expect(c.json).toHaveBeenCalledWith({ id: 'did:resolved' });
        // Should trigger cache update
        expect(mockWaitUntil).toHaveBeenCalled();
        const putCall = mockFetch.mock.calls.find((call: any) => call[0].method === 'PUT' || (call[0] instanceof Request && call[0].method === 'PUT'));
        // Note: The implementation uses `new Request(..., { method: 'PUT' })`. 
        // Vitest spy captures the Request object. 
        // We can inspect the last call to fetch which should be the PUT.
        // But since we had a cache miss fetch first, the PUT is the second call.
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should resolve and cache if forceRefresh is true', async () => {
        mockResolve.mockResolvedValue({ didDocument: { id: 'did:fresh' } });
        const c = createCtx({ actor: 'did:test', forceRefresh: 'true' }, mockEnv());

        await handle(c);

        // Should NOT check cache (first fetch skipped)
        expect(mockResolve).toHaveBeenCalledWith('did:test');
        expect(c.json).toHaveBeenCalledWith({ id: 'did:fresh' });
        // Should save to cache
        expect(mockFetch).toHaveBeenCalledTimes(1); // Only PUT
    });

    it('should handle resolution error', async () => {
        mockResolve.mockRejectedValue(new Error('Resolution failed'));
        const c = createCtx({ actor: 'did:test', forceRefresh: 'true' }, mockEnv());

        await handle(c);

        expect(c.json).toHaveBeenCalledWith({ error: 'Resolution failed' }, 500);
    });
});
