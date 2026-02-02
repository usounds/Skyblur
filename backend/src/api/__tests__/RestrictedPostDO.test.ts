import { describe, it, expect, vi } from 'vitest';
import { RestrictedPostDO } from '../RestrictedPostDO';

describe('RestrictedPostDO', () => {
    it('should handle PUT and GET requests', async () => {
        const storage = new Map();
        const state: any = {
            storage: {
                get: vi.fn((key) => storage.get(key)),
                put: vi.fn((key, val) => storage.set(key, val)),
                delete: vi.fn((key) => storage.delete(key))
            }
        };
        const env: any = {};

        const doInstance = new RestrictedPostDO(state, env);

        // PUT
        const putReq = new Request('http://do/?key=test', {
            method: 'PUT',
            body: JSON.stringify({ text: 'Hello' })
        });
        await doInstance.fetch(putReq);
        expect(state.storage.put).toHaveBeenCalledWith('test', { text: 'Hello' });

        // GET
        const getReq = new Request('http://do/?key=test', { method: 'GET' });
        const res = await doInstance.fetch(getReq);
        const data = await res.json();
        expect(data).toEqual({ text: 'Hello' });
    });

    it('should handle DELETE request', async () => {
        const state: any = {
            storage: {
                delete: vi.fn()
            }
        };
        const doInstance = new RestrictedPostDO(state, {} as any);

        const req = new Request('http://do/?key=del', { method: 'DELETE' });
        await doInstance.fetch(req);
        expect(state.storage.delete).toHaveBeenCalledWith('del');
    });

    it('should handle dump request', async () => {
        const storage = new Map([
            ['key1', { text: 'one' }],
            ['key2', { text: 'two' }]
        ]);
        const state: any = {
            storage: {
                list: vi.fn(async () => storage),
                get: vi.fn((key) => storage.get(key)),
            }
        };
        const doInstance = new RestrictedPostDO(state, {} as any);

        const req = new Request('http://do/dump', { method: 'GET' });
        const res = await doInstance.fetch(req);
        const data = await res.json();

        expect(data).toEqual({
            key1: { text: 'one' },
            key2: { text: 'two' }
        });
    });
});
