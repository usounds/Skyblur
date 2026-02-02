import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handle } from '../decryptByCid';
import * as CryptHandler from '@/logic/CryptHandler';

vi.mock('@/logic/CryptHandler');

describe('decryptByCid API', () => {
    let mockFetch: any;
    let mockDOFetch: any;
    let mockDONamespace: any;

    beforeEach(() => {
        vi.resetAllMocks();
        mockFetch = vi.fn();
        global.fetch = mockFetch;

        mockDOFetch = vi.fn();
        mockDONamespace = {
            idFromName: vi.fn().mockReturnValue('do-id'),
            get: vi.fn().mockReturnValue({ fetch: mockDOFetch })
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const createCtx = (body: any) => {
        return {
            req: {
                json: vi.fn().mockResolvedValue(body)
            },
            json: vi.fn(),
            env: {
                SKYBLUR_DO: mockDONamespace
            },
            executionCtx: {
                waitUntil: vi.fn()
            }
        } as any;
    };


    it('should decrypt content if all params present (skip resolution)', async () => {
        const c = createCtx({
            pds: 'https://pds.example.com',
            repo: 'did:example:123',
            cid: 'bafy...',
            password: 'pass'
        });

        // @ts-ignore
        CryptHandler.getDecrypt.mockResolvedValue({ text: 'Decrypted', additional: 'Info' });

        await handle(c);

        expect(CryptHandler.getDecrypt).toHaveBeenCalledWith(
            'https://pds.example.com',
            'did:example:123',
            'bafy...',
            'pass'
        );
        expect(c.json).toHaveBeenCalledWith({ text: 'Decrypted', additional: 'Info' });
        expect(mockDONamespace.get).not.toHaveBeenCalled();
    });

    it('should resolve PDS from DO cache', async () => {
        const c = createCtx({
            repo: 'did:plc:123',
            cid: 'bafy...',
            password: 'pass'
        });

        // Mock DO Cache Hit
        mockDOFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                service: [{ type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://cached.pds' }]
            })
        });

        // @ts-ignore
        CryptHandler.getDecrypt.mockResolvedValue({ text: 'Decrypted' });

        await handle(c);

        expect(mockDONamespace.get).toHaveBeenCalled();
        expect(CryptHandler.getDecrypt).toHaveBeenCalledWith(
            'https://cached.pds',
            'did:plc:123',
            expect.anything(),
            expect.anything()
        );
    });

    it('should resolve PDS from PLC directory if cache miss', async () => {
        const c = createCtx({
            repo: 'did:plc:123',
            cid: 'bafy...',
            password: 'pass'
        });

        // Mock DO Cache Miss
        mockDOFetch.mockResolvedValue({ ok: false });

        // Mock PLC Fetch
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                service: [{ type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://plc.pds' }]
            })
        });

        // @ts-ignore
        CryptHandler.getDecrypt.mockResolvedValue({ text: 'Decrypted' });

        await handle(c);

        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('plc.directory'));
        expect(c.executionCtx.waitUntil).toHaveBeenCalled(); // Should cache result
        expect(CryptHandler.getDecrypt).toHaveBeenCalledWith(
            'https://plc.pds',
            'did:plc:123',
            expect.anything(),
            expect.anything()
        );
    });

    it('should fail if PDS cannot be resolved', async () => {
        const c = createCtx({
            repo: 'did:plc:123',
            cid: 'bafy...',
            password: 'pass'
        });

        // Mock DO Cache Miss
        mockDOFetch.mockResolvedValue({ ok: false });
        // Mock PLC Fail
        mockFetch.mockResolvedValue({ ok: false });

        await handle(c);

        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('pds is required') }), 500);
    });

    it('should fail if PDS is missing', async () => {
        const c = createCtx({});
        await handle(c);
        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('pds is required') }), 500);
    });

    it('should fail if repo is missing', async () => {
        const c = createCtx({ pds: 'https://pds' });
        await handle(c);
        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('repo is required') }), 500);
    });

    it('should fail if cid is missing', async () => {
        const c = createCtx({ pds: 'https://pds', repo: 'did:repo' });
        await handle(c);
        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('cid is required') }), 500);
    });

    it('should fail if password is missing', async () => {
        const c = createCtx({ pds: 'https://pds', repo: 'did:repo', cid: 'cid' });
        await handle(c);
        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('password is required') }), 500);
    });
});
