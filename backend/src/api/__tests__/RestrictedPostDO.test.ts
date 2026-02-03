import { describe, it, expect, vi } from 'vitest';
import { RestrictedPostDO } from '../RestrictedPostDO';

describe('RestrictedPostDO', () => {
    it('should handle PUT and GET requests', async () => {
        const postsDB: any[] = [];
        const configDB: any[] = [];

        // Mock SQL execution
        const sqlExec = vi.fn((query: string, ...args: any[]) => {
            const q = query.trim().toUpperCase();

            // Initialization (CREATE TABLE)
            if (q.startsWith('CREATE TABLE')) return;

            // INSERT OR REPLACE INTO posts
            if (q.startsWith('INSERT OR REPLACE INTO POSTS')) {
                const [rkey, text, additional, visibility, created_at] = args;
                const existingIndex = postsDB.findIndex(p => p.rkey === rkey);
                const row = { rkey, text, additional, visibility, created_at };
                if (existingIndex >= 0) {
                    postsDB[existingIndex] = row;
                } else {
                    postsDB.push(row);
                }
                return;
            }

            // INSERT OR REPLACE INTO config
            if (q.startsWith('INSERT OR REPLACE INTO CONFIG')) {
                const [value] = args; // args[0] is the value for 'did'
                const row = { key: 'did', value };
                const existingIndex = configDB.findIndex(c => c.key === 'did');
                if (existingIndex >= 0) {
                    configDB[existingIndex] = row;
                } else {
                    configDB.push(row);
                }
                return;
            }

            // SELECT ... FROM posts WHERE rkey = ?
            if (q.startsWith('SELECT TEXT, ADDITIONAL, VISIBILITY FROM POSTS')) {
                const [key] = args;
                const row = postsDB.find(p => p.rkey === key);
                return {
                    one: () => row || null
                } as any;
            }

            return {
                one: () => null,
                [Symbol.iterator]: function* () { yield* []; }
            } as any;
        });

        const state: any = {
            storage: {
                sql: {
                    exec: sqlExec
                }
            }
        };
        const env: any = {};

        const doInstance = new RestrictedPostDO(state, env);

        // PUT
        const putReq = new Request('http://do/?key=test', {
            method: 'PUT',
            body: JSON.stringify({ text: 'Hello', additional: 'meta', visibility: 'followers', did: 'did:user' })
        });
        await doInstance.fetch(putReq);

        // Assert SQL interaction
        expect(sqlExec).toHaveBeenCalled();

        // GET
        const getReq = new Request('http://do/?key=test', { method: 'GET' });
        const res = await doInstance.fetch(getReq);
        const data = await res.json();

        expect(data).toMatchObject({ text: 'Hello', visibility: 'followers' });
    });

    it('should handle DELETE request', async () => {
        const postsDB: any[] = [{ rkey: 'del', text: 'delete me' }];
        const sqlExec = vi.fn((query: string, ...args: any[]) => {
            const q = query.trim().toUpperCase();
            if (q.startsWith('CREATE TABLE')) return;

            if (q.startsWith('DELETE FROM POSTS')) {
                const [key] = args;
                const idx = postsDB.findIndex(p => p.rkey === key);
                if (idx >= 0) postsDB.splice(idx, 1);
                return;
            }
        });

        const state: any = {
            storage: {
                sql: { exec: sqlExec }
            }
        };
        const doInstance = new RestrictedPostDO(state, {} as any);

        const req = new Request('http://do/?key=del', { method: 'DELETE' });
        await doInstance.fetch(req);

        expect(postsDB.length).toBe(0);
    });

    it('should handle dump request', async () => {
        const postsDB = [
            { rkey: 'key1', text: 'one' },
            { rkey: 'key2', text: 'two' }
        ];
        const configDB = [{ key: 'did', value: 'did:user' }];

        const sqlExec = vi.fn((query: string) => {
            const q = query.trim().toUpperCase();
            if (q.startsWith('CREATE TABLE')) return;

            if (q.startsWith('SELECT * FROM POSTS')) {
                return {
                    [Symbol.iterator]: function* () { yield* postsDB; }
                };
            }
            if (q.startsWith('SELECT VALUE FROM CONFIG')) {
                return {
                    one: () => configDB[0]
                };
            }
        });

        const state: any = {
            storage: {
                sql: { exec: sqlExec }
            }
        };
        const doInstance = new RestrictedPostDO(state, {} as any);

        const req = new Request('http://do/dump', { method: 'GET' });
        const res = await doInstance.fetch(req);
        const data = await res.json() as any;

        expect(data.did).toBe('did:user');
        expect(data.posts).toHaveLength(2);
        expect(data.posts[0].text).toBe('one');
    });

    it('should return 404 if row not found in GET', async () => {
        const sqlExec = vi.fn().mockReturnValue({ one: () => null });
        const state: any = { storage: { sql: { exec: sqlExec } } };
        const doInstance = new RestrictedPostDO(state, {} as any);

        const req = new Request('http://do/?key=missing', { method: 'GET' });
        const res = await doInstance.fetch(req);
        expect(res.status).toBe(404);
    });

    it('should return 400 if key is missing in PUT', async () => {
        const doInstance = new RestrictedPostDO({ storage: { sql: { exec: vi.fn() } } } as any, {} as any);
        const req = new Request('http://do/', { method: 'PUT', body: JSON.stringify({}) }); // No key param
        const res = await doInstance.fetch(req);
        expect(res.status).toBe(400);
    });

    it('should return 400 if key is missing in GET', async () => {
        const doInstance = new RestrictedPostDO({ storage: { sql: { exec: vi.fn() } } } as any, {} as any);
        const req = new Request('http://do/', { method: 'GET' }); // No key param
        const res = await doInstance.fetch(req);
        expect(res.status).toBe(400);
    });

    it('should return 400 if key is missing in DELETE', async () => {
        const doInstance = new RestrictedPostDO({ storage: { sql: { exec: vi.fn() } } } as any, {} as any);
        const req = new Request('http://do/', { method: 'DELETE' }); // No key param
        const res = await doInstance.fetch(req);
        expect(res.status).toBe(400);
    });

    it('should return 405 for unsupported methods', async () => {
        const doInstance = new RestrictedPostDO({ storage: { sql: { exec: vi.fn() } } } as any, {} as any);
        const req = new Request('http://do/?key=test', { method: 'POST' });
        const res = await doInstance.fetch(req);
        expect(res.status).toBe(405);
    });
});
