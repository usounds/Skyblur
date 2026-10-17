import { DatabaseSync } from 'node:sqlite';
import { afterEach, expect, it, vi } from 'vitest';
import { JetstreamIngestDO } from '../JetstreamIngestDO';
import { PostMirrorDO } from '../PostMirrorDO';
import { publicMirrorSource } from '../jetstream';

const databases: DatabaseSync[] = [];
function sqliteState() {
  const db = new DatabaseSync(':memory:'); databases.push(db);
  const exec = vi.fn((query: string, ...args: unknown[]) => {
    if (query.includes('CREATE TABLE')) { db.exec(query); return { toArray: () => [], rowsWritten: 0 }; }
    const statement = db.prepare(query);
    if (/^\s*(SELECT|PRAGMA)/i.test(query)) return { toArray: () => statement.all(...args as never[]), rowsWritten: 0 };
    const result = statement.run(...args as never[]);
    return { toArray: () => [], rowsWritten: Number(result.changes) };
  });
  const ctx = { storage: { sql: { exec }, transactionSync: (fn: () => unknown) => {
    db.exec('BEGIN');
    try { const result = fn(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  } } } as unknown as DurableObjectState;
  return { db, ctx, exec };
}
afterEach(() => { vi.restoreAllMocks(); for (const db of databases.splice(0)) db.close(); });
const item = { eventId: 'synthetic', did: 'did:plc:author', timeUs: 200, kind: 'commit', commit: {
  operation: 'create', collection: 'uk.skyblur.post', rkey: 'one', record: { text: 'hello' },
} };
const batch = { cursor: 200, events: [item] };
function ingestRequest(id = 'a'.repeat(64), value = batch) {
  return new Request('https://do/ingest', { method: 'POST', headers: { 'x-skyblur-ingest-id': id }, body: JSON.stringify(value) });
}
function mirrorNamespace(fetch: ReturnType<typeof vi.fn>) {
  return { idFromName: () => 'mirror', get: () => ({ fetch }) };
}

it('reuses a successful receipt across DO restart without projection or meta writes', async () => {
  const { db, ctx, exec } = sqliteState();
  const fetch = vi.fn(async () => Response.json({ accepted: true, projected: true }));
  const env = { SKYBLUR_DO_POST_MIRROR: mirrorNamespace(fetch) } as never;
  const first = await new JetstreamIngestDO(ctx, env).fetch(ingestRequest());
  const expected = await first.json();
  const restarted = new JetstreamIngestDO(ctx, env); exec.mockClear();
  const replay = await restarted.fetch(ingestRequest());
  expect(await replay.json()).toEqual(expected);
  expect(fetch).toHaveBeenCalledOnce();
  expect(exec.mock.calls.some(([query]) => query.startsWith('INSERT INTO meta'))).toBe(false);
  expect(db.prepare('SELECT COUNT(*) AS count FROM ingest_receipts').get()).toMatchObject({ count: 1 });
});

it('shares parallel retries and returns separately consumable responses', async () => {
  const { ctx } = sqliteState();
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const fetch = vi.fn(async () => { await blocked; return Response.json({ accepted: true, projected: true }); });
  const object = new JetstreamIngestDO(ctx, { SKYBLUR_DO_POST_MIRROR: mirrorNamespace(fetch) } as never);
  const first = object.fetch(ingestRequest());
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  const second = object.fetch(ingestRequest()); release();
  const responses = await Promise.all([first, second]);
  expect(await responses[0].json()).toEqual(await responses[1].json());
  expect(fetch).toHaveBeenCalledOnce();
});

it('does not cache partial failures and permits a complete retry', async () => {
  const { db, ctx } = sqliteState();
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({ accepted: true, projected: true }))
    .mockResolvedValueOnce(Response.json({ error: 'unavailable' }, { status: 503 }))
    .mockImplementation(async () => Response.json({ accepted: true, duplicate: true }));
  const object = new JetstreamIngestDO(ctx, { SKYBLUR_DO_POST_MIRROR: mirrorNamespace(fetch) } as never);
  const value = { cursor: 200, events: [item, { ...item, commit: { ...item.commit, rkey: 'two' } }] };
  expect((await object.fetch(ingestRequest('b'.repeat(64), value))).status).toBe(503);
  expect(db.prepare('SELECT COUNT(*) AS count FROM ingest_receipts').get()).toMatchObject({ count: 0 });
  expect((await object.fetch(ingestRequest('b'.repeat(64), value))).status).toBe(200);
  expect(fetch).toHaveBeenCalledTimes(4);
});

it('expires receipts and refuses growth beyond its capacity', async () => {
  const { db, ctx } = sqliteState();
  const fetch = vi.fn(async () => Response.json({ accepted: true, projected: true }));
  const object = new JetstreamIngestDO(ctx, { SKYBLUR_DO_POST_MIRROR: mirrorNamespace(fetch) } as never);
  const put = db.prepare('INSERT INTO ingest_receipts VALUES (?, ?, ?)');
  for (let i = 0; i < 4096; i++) put.run(String(i), Date.now() + 60_000, '{}');
  expect((await object.fetch(ingestRequest())).status).toBe(503);
  expect(fetch).not.toHaveBeenCalled();
  db.prepare('UPDATE ingest_receipts SET expires_at = 0').run();
  expect((await object.fetch(ingestRequest())).status).toBe(200);
  expect(db.prepare('SELECT COUNT(*) AS count FROM ingest_receipts').get()).toMatchObject({ count: 1 });
});

it('rejects anonymous source probes before choosing or initializing a DO', async () => {
  const namespace = { idFromName: vi.fn(), get: vi.fn() };
  const response = await publicMirrorSource({ req: { header: () => undefined, query: () => 'did:fake:one' },
    env: { SKYBLUR_DO_POST_MIRROR: namespace, MIRROR_INSPECT_TOKEN: 'synthetic-secret' },
    json: (body: unknown, status: number) => Response.json(body, { status }),
  } as never);
  expect(response.status).toBe(401); expect(namespace.idFromName).not.toHaveBeenCalled();
});

it('keeps empty mirror reads free of persistent schema or metadata writes', async () => {
  const { db, ctx } = sqliteState();
  const object = new PostMirrorDO(ctx, {} as never);
  const response = await object.fetch(new Request('https://do/record?repo=did:fake:one&rkey=key'));
  expect(response.status).toBe(404);
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()).toEqual([]);
});
