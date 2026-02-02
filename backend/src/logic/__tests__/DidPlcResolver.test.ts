import { describe, it, expect, vi } from 'vitest';
import { getResolver } from '../DidPlcResolver';

describe('DidPlcResolver', () => {
    it('should resolve a DID using plc.directory', async () => {
        const did = 'did:plc:123';
        const doc = {
            id: did,
            verificationMethod: []
        };

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => doc
        });

        const resolverMap = getResolver();
        const plcResolver = resolverMap.plc;

        const result = await plcResolver(did, {} as any, {} as any, {});

        expect(global.fetch).toHaveBeenCalledWith('https://plc.directory/did%3Aplc%3A123');
        expect(result.didDocument).toEqual(doc);
    });

    it('should return error if fetch fails', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 404
        });

        const resolverMap = getResolver();
        const plcResolver = resolverMap.plc;

        const result = await plcResolver('did:plc:404', {} as any, {} as any, {});

        expect(result.didResolutionMetadata.error).toBe('notFound');
    });
});
