import { describe, expect, it, vi } from 'vitest';
import { JetstreamIngestDO } from '../JetstreamIngestDO';
import { PostMirrorDO } from '../PostMirrorDO';
import { canonicalEventId, type JetstreamEvent } from '../jetstream';

class Cursor<T extends object> implements Iterable<T> {
  constructor(private readonly rows: T[] = [], public readonly rowsWritten = 0) {}
  toArray() { return [...this.rows]; }
  [Symbol.iterator]() { return this.rows[Symbol.iterator](); }
}

class IngestSQL {
  quarantineColumns = new Set([
    'hash', 'time_us', 'reason', 'did', 'collection', 'rkey', 'created_at',
    'resolution', 'resolved_at', 'remediated_by',
  ]);
  meta = new Map<string, string>();
  quarantines = new Map<string, {
    hash: string; time_us: number; reason: string; did: string | null;
    collection: string | null; rkey: string | null; created_at: number;
    resolution: string | null; resolved_at: number | null; remediated_by: string | null;
  }>();
  exec<T extends object>(query: string, ...args: unknown[]): Cursor<T> {
    const sql = query.replace(/\s+/g, ' ').trim();
    if (
      sql.startsWith('CREATE TABLE')
      || sql.startsWith('CREATE INDEX')
    ) return new Cursor<T>();
    if (sql === 'PRAGMA table_info(quarantined_frames)') {
      return new Cursor<T>([...this.quarantineColumns].map((name) => ({ name }) as T));
    }
    if (sql.startsWith('ALTER TABLE quarantined_frames ADD COLUMN')) {
      this.quarantineColumns.add(sql.split(' ')[5]);
      return new Cursor<T>();
    }
    if (sql.startsWith('SELECT value FROM meta')) {
      const value = this.meta.get(String(args[0]));
      return new Cursor<T>(value === undefined ? [] : [{ value } as T]);
    }
    if (sql.startsWith('INSERT INTO meta')) {
      this.meta.set(String(args[0]), String(args[1]));
      return new Cursor<T>([], 1);
    }
    if (sql.startsWith('INSERT OR IGNORE INTO quarantined_frames')) {
      const hash = String(args[0]);
      if (this.quarantines.has(hash)) return new Cursor<T>([], 0);
      this.quarantines.set(hash, {
        hash, time_us: Number(args[1]), reason: String(args[2]),
        did: args[3] === null ? null : String(args[3]),
        collection: args[4] === null ? null : String(args[4]),
        rkey: args[5] === null ? null : String(args[5]),
        created_at: Number(args[6]), resolution: null, resolved_at: null, remediated_by: null,
      });
      return new Cursor<T>([], 1);
    }
    if (sql.startsWith('SELECT COUNT(*) AS total')) {
      const rows = [...this.quarantines.values()];
      return new Cursor<T>([{
        total: rows.length,
        unresolved: rows.filter((row) => row.resolution === null).length,
        ignored: rows.filter((row) => row.resolution === 'ignored').length,
      } as T]);
    }
    if (sql.startsWith('SELECT hash, time_us, reason, did, collection, rkey, created_at')) {
      return new Cursor<T>([...this.quarantines.values()] as T[]);
    }
    if (sql.startsWith('UPDATE quarantined_frames SET resolution')) {
      const row = this.quarantines.get(String(args[3]));
      if (!row || row.resolution !== null) return new Cursor<T>([], 0);
      row.resolution = String(args[0]);
      row.resolved_at = Number(args[1]);
      row.remediated_by = String(args[2]);
      return new Cursor<T>([], 1);
    }
    throw new Error(`Unsupported ingest SQL: ${sql}`);
  }
}

class MirrorSQL {
  events = new Map<string, object>();
  orders = new Map<string, any>();
  records = new Map<string, any>();
  meta = new Map<string, string>();
  backfill: any = null;

  exec<T extends object>(query: string, ...args: unknown[]): Cursor<T> {
    const sql = query.replace(/\s+/g, ' ').trim();
    if (sql.startsWith('DROP TABLE IF EXISTS events')) {
      this.events.clear();
      return new Cursor<T>();
    }
    if (sql.startsWith('CREATE TABLE')) return new Cursor<T>();
    if (sql.startsWith('SELECT source, time_us')) {
      const row = this.orders.get(`${args[0]}/${args[1]}/${args[2]}`);
      return new Cursor<T>(row ? [row as T] : []);
    }
    if (sql.startsWith('SELECT operation, rev, event_time')) {
      const row = this.records.get(`${args[0]}/${args[1]}/${args[2]}`);
      return new Cursor<T>(row ? [row as T] : []);
    }
    if (sql.startsWith('INSERT INTO records')) {
      const key = `${args[0]}/${args[1]}/${args[2]}`;
      this.records.set(key, {
        repo: args[0], collection: args[1], rkey: args[2], operation: args[3],
        cid: args[4], rev: args[5], event_time: args[6], received_at: args[7], value_json: args[8],
      });
      return new Cursor<T>([], 1);
    }
    if (sql.startsWith('INSERT INTO record_order')) {
      const key = `${args[0]}/${args[1]}/${args[2]}`;
      this.orders.set(key, {
        source: args[3], time_us: args[4], rev: args[5], operation: args[6], event_id: args[7],
      });
      return new Cursor<T>([], 1);
    }
    if (sql === "SELECT value FROM meta WHERE key = 'watermark'") {
      const value = this.meta.get('watermark');
      return new Cursor<T>(value ? [{ value } as T] : []);
    }
    if (sql === 'SELECT value FROM meta WHERE key = ?') {
      const value = this.meta.get(String(args[0]));
      return new Cursor<T>(value ? [{ value } as T] : []);
    }
    if (sql.startsWith("INSERT INTO meta (key, value) VALUES ('watermark'")) {
      this.meta.set('watermark', String(args[0]));
      return new Cursor<T>([], 1);
    }
    if (sql.startsWith('INSERT INTO meta (key, value) VALUES (?, ?)')) {
      this.meta.set(String(args[0]), String(args[1]));
      return new Cursor<T>([], 1);
    }
    if (sql.startsWith('SELECT r.operation, r.cid, r.rev')) {
      const key = `${args[0]}/${args[1]}/${args[2]}`;
      const row = this.records.get(key);
      const order = this.orders.get(key);
      return new Cursor<T>(row ? [{ ...row, source: order?.source ?? null } as T] : []);
    }
    if (sql.startsWith('SELECT repo, collection, rkey, operation')) {
      const rows = [...this.records.values()].filter((row) => row.repo === args[0]);
      return new Cursor<T>(rows as T[]);
    }
    if (sql.startsWith('SELECT COUNT(*) AS records')) {
      const rows = [...this.records.values()];
      return new Cursor<T>([{
        records: rows.length,
        activeRecords: rows.filter((row) => row.operation !== 'delete').length,
        deletedRecords: rows.filter((row) => row.operation === 'delete').length,
      } as T]);
    }
    if (sql === 'SELECT * FROM records') {
      return new Cursor<T>([...this.records.values()] as T[]);
    }
    if (sql === 'SELECT * FROM record_order') {
      return new Cursor<T>([...this.orders.values()] as T[]);
    }
    if (sql === 'SELECT * FROM backfill_state') {
      return new Cursor<T>(this.backfill ? [this.backfill as T] : []);
    }
    if (sql === 'SELECT * FROM meta') {
      return new Cursor<T>([...this.meta.entries()].map(([key, value]) => ({ key, value })) as T[]);
    }
    if (sql.startsWith('SELECT cursor, status')) return new Cursor<T>(this.backfill ? [this.backfill as T] : []);
    if (sql.startsWith('INSERT INTO backfill_state')) {
      this.backfill = {
        cursor: args[1], status: args[2], records_processed: args[3], updated_at: args[4], last_error: args[5],
      };
      return new Cursor<T>([], 1);
    }
    throw new Error(`Unsupported mirror SQL: ${sql}`);
  }
}

function state(sql: IngestSQL | MirrorSQL) {
  return {
    storage: {
      sql,
      transactionSync: vi.fn((callback: () => unknown) => callback()),
    },
  } as any;
}

async function makeEvent(operation: 'create' | 'update' | 'delete', timeUs: number, rev: string): Promise<JetstreamEvent> {
  const value = {
    did: 'did:plc:author', timeUs, kind: 'commit' as const,
    commit: {
      rev, operation, collection: 'uk.skyblur.post' as const, rkey: 'post',
      cid: operation === 'delete' ? undefined : `cid-${rev}`,
      record: operation === 'delete' ? undefined : { text: rev },
    },
  };
  return { eventId: await canonicalEventId(value), ...value };
}

describe('JetstreamIngestDO', () => {
  it('upgrades a previously deployed quarantine table in place', () => {
    const sql = new IngestSQL();
    sql.quarantineColumns = new Set(['hash', 'time_us', 'reason', 'created_at']);
    new JetstreamIngestDO(state(sql), { SKYBLUR_DO_POST_MIRROR: {} } as any);
    expect(sql.quarantineColumns).toEqual(new Set([
      'hash', 'time_us', 'reason', 'created_at', 'did', 'collection', 'rkey',
      'resolution', 'resolved_at', 'remediated_by',
    ]));
  });

  it('projects every event before monotonically advancing the durable cursor', async () => {
    const sql = new IngestSQL();
    const durableState = state(sql);
    const mirrorStub = { fetch: vi.fn()
      .mockResolvedValueOnce(Response.json({ accepted: true, projected: true, duplicate: false, stale: false }))
      .mockResolvedValueOnce(Response.json({ accepted: true, projected: false, duplicate: true, stale: false })) };
    const namespace = { idFromName: vi.fn().mockReturnValue('id'), get: vi.fn().mockReturnValue(mirrorStub) };
    const object = new JetstreamIngestDO(durableState, { SKYBLUR_DO_POST_MIRROR: namespace } as any);
    const item = await makeEvent('create', 200, 'rev-1');

    const first = await object.fetch(new Request('https://do/ingest', {
      method: 'POST', body: JSON.stringify({ cursor: 200, events: [item] }),
    }));
    expect(await first.json()).toEqual(expect.objectContaining({
      committedCursor: 200, projected: 1, duplicates: 0, stale: 0,
    }));
    const replay = await object.fetch(new Request('https://do/ingest', {
      method: 'POST', body: JSON.stringify({ cursor: 190, events: [item] }),
    }));
    expect(await replay.json()).toEqual(expect.objectContaining({
      committedCursor: 200, projected: 0, duplicates: 1, stale: 0,
    }));
    expect(mirrorStub.fetch).toHaveBeenCalledTimes(2);
    expect(sql.meta.get('committedCursor')).toBe('200');
  });

  it('returns a retryable error and leaves the cursor unchanged after a partial projection', async () => {
    const sql = new IngestSQL();
    const first = await makeEvent('create', 100, 'rev-1');
    const second = await makeEvent('update', 200, 'rev-2');
    const mirrorStub = { fetch: vi.fn()
      .mockResolvedValueOnce(Response.json({ accepted: true, projected: true }))
      .mockResolvedValueOnce(Response.json({ error: 'invalid' }, { status: 400 }))
      .mockImplementation(() => Promise.resolve(Response.json({ accepted: true, duplicate: true }))) };
    const namespace = { idFromName: vi.fn().mockReturnValue('id'), get: vi.fn().mockReturnValue(mirrorStub) };
    const object = new JetstreamIngestDO(state(sql), { SKYBLUR_DO_POST_MIRROR: namespace } as any);
    const quarantine = { cursor: 200, hash: 'b'.repeat(64), reason: 'invalid_record' };
    const request = () => new Request('https://do/ingest', {
      method: 'POST', body: JSON.stringify({ cursor: 200, events: [first, second], quarantined: [quarantine] }),
    });

    const failed = await object.fetch(request());
    expect(failed.status).toBe(503);
    expect(sql.meta.has('committedCursor')).toBe(false);
    expect(sql.quarantines.size).toBe(0);

    const retried = await object.fetch(request());
    expect(retried.status).toBe(200);
    expect(sql.meta.get('committedCursor')).toBe('200');
    expect(sql.quarantines.has(quarantine.hash)).toBe(true);
    expect(mirrorStub.fetch).toHaveBeenCalledTimes(4);
  });

  it('treats an unaccepted mirror response as retryable and does not commit', async () => {
    const sql = new IngestSQL();
    const item = await makeEvent('create', 200, 'rev-1');
    const mirrorStub = { fetch: vi.fn().mockResolvedValue(Response.json({ accepted: false })) };
    const namespace = { idFromName: vi.fn().mockReturnValue('id'), get: vi.fn().mockReturnValue(mirrorStub) };
    const object = new JetstreamIngestDO(state(sql), { SKYBLUR_DO_POST_MIRROR: namespace } as any);
    const response = await object.fetch(new Request('https://do/ingest', {
      method: 'POST', body: JSON.stringify({ cursor: 200, events: [item] }),
    }));
    expect(response.status).toBe(503);
    expect(sql.meta.has('committedCursor')).toBe(false);
  });

  it('defends against a future cursor even if the public handler is bypassed', async () => {
    const sql = new IngestSQL();
    const object = new JetstreamIngestDO(state(sql), { SKYBLUR_DO_POST_MIRROR: {} } as any);
    const response = await object.fetch(new Request('https://do/ingest', {
      method: 'POST',
      body: JSON.stringify({ cursor: Date.now() * 1_000 + 6 * 60 * 1_000_000, events: [] }),
    }));
    expect(response.status).toBe(400);
    expect(sql.meta.has('committedCursor')).toBe(false);
  });

  it('durably records quarantined frame metadata before advancing its cursor', async () => {
    const sql = new IngestSQL();
    const object = new JetstreamIngestDO(state(sql), { SKYBLUR_DO_POST_MIRROR: {} } as any);
    const quarantine = { cursor: 200, hash: 'a'.repeat(64), reason: 'invalid_record' };
    const response = await object.fetch(new Request('https://do/ingest', {
      method: 'POST', body: JSON.stringify({ cursor: 200, events: [], quarantined: [quarantine] }),
    }));
    expect(await response.json()).toEqual(expect.objectContaining({
      committedCursor: 200, quarantined: 1, quarantineDuplicates: 0,
    }));
    expect(sql.quarantines.get(quarantine.hash)).toEqual(expect.objectContaining({ time_us: 200 }));

    const stateResponse = await object.fetch(new Request('https://do/state'));
    const current = await stateResponse.json() as any;
    expect(current).toEqual(expect.objectContaining({
      projectionMode: 'synchronous', projectionHealthy: false, quarantinedFrames: 1,
    }));
    expect(current.recentQuarantines[0]).toEqual(expect.objectContaining({ hash: quarantine.hash, timeUs: 200 }));

    const resolve = await object.fetch(new Request('https://do/quarantine/resolve', {
      method: 'POST',
      body: JSON.stringify({ hash: quarantine.hash, resolution: 'backfilled', remediatedBy: 'test-operator' }),
    }));
    expect(await resolve.json()).toEqual({ accepted: true, resolved: 1 });
    expect(sql.quarantines.get(quarantine.hash)).toEqual(expect.objectContaining({
      resolution: 'backfilled', remediated_by: 'test-operator',
    }));
    const healthy = await (await object.fetch(new Request('https://do/state'))).json() as any;
    expect(healthy.projectionHealthy).toBe(true);
  });

});

describe('PostMirrorDO', () => {
  it('applies create and delete atomically and rejects an older update', async () => {
    const sql = new MirrorSQL();
    const durableState = state(sql);
    const object = new PostMirrorDO(durableState, {} as any);
    const create = await makeEvent('create', 100, 'rev-1');
    const deletion = await makeEvent('delete', 300, 'rev-3');
    const staleUpdate = await makeEvent('update', 200, 'rev-2');

    expect(await (await object.fetch(new Request('https://do/event', { method: 'POST', body: JSON.stringify(create) }))).json())
      .toEqual(expect.objectContaining({ projected: true, stale: false }));
    expect(await (await object.fetch(new Request('https://do/event', { method: 'POST', body: JSON.stringify(deletion) }))).json())
      .toEqual(expect.objectContaining({ projected: true, stale: false }));
    expect(await (await object.fetch(new Request('https://do/event', { method: 'POST', body: JSON.stringify(staleUpdate) }))).json())
      .toEqual(expect.objectContaining({ projected: false, stale: true }));
    expect(sql.records.get('did:plc:author/uk.skyblur.post/post')?.operation).toBe('delete');
    expect((await object.fetch(
      new Request('https://do/record?repo=did:plc:author&rkey=post'),
    )).status).toBe(410);
    expect(durableState.storage.transactionSync).toHaveBeenCalledTimes(4);
  });

  it('uses snapshot time between PDS fallback and Jetstream projections', async () => {
    const sql = new MirrorSQL();
    const object = new PostMirrorDO(state(sql), {} as any);
    const fallback = {
      ...await makeEvent('create', 300, 'pds'),
      eventId: 'pds:did:plc:author:post:cid-pds',
      source: 'pds' as const,
    };
    const delayed = await makeEvent('update', 100, 'rev-delayed');
    const live = await makeEvent('update', 400, 'rev-live');

    expect(await (await object.fetch(new Request('https://do/event', {
      method: 'POST', body: JSON.stringify(fallback),
    }))).json()).toEqual(expect.objectContaining({ projected: true }));
    expect(sql.meta.has('watermark')).toBe(false);
    expect(await (await object.fetch(new Request('https://do/event', {
      method: 'POST', body: JSON.stringify(delayed),
    }))).json()).toEqual(expect.objectContaining({ projected: false, stale: true }));
    expect(await (await object.fetch(new Request('https://do/event', {
      method: 'POST', body: JSON.stringify(live),
    }))).json()).toEqual(expect.objectContaining({ projected: true, stale: false }));
    expect(sql.records.get('did:plc:author/uk.skyblur.post/post')?.value_json)
      .toBe(JSON.stringify({ text: 'rev-live' }));
    expect(sql.orders.get('did:plc:author/uk.skyblur.post/post')?.source).toBe('jetstream');
    expect(JSON.parse(sql.meta.get('watermark') ?? '{}')).toEqual(expect.objectContaining({ timeUs: 400 }));
  });

  it('returns the projection source with an active record', async () => {
    const sql = new MirrorSQL();
    const object = new PostMirrorDO(state(sql), {} as any);
    const fallback = {
      ...await makeEvent('create', 300, 'pds'),
      eventId: 'pds:did:plc:author:post:cid-pds',
      source: 'pds' as const,
    };
    await object.fetch(new Request('https://do/event', {
      method: 'POST', body: JSON.stringify(fallback),
    }));

    const response = await object.fetch(
      new Request('https://do/record?repo=did:plc:author&rkey=post'),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      source: 'pds',
      value: { text: 'pds' },
    }));
  });

  it('does not retain cumulative event history and deduplicates against the latest order', async () => {
    const sql = new MirrorSQL();
    sql.events.set('legacy-event', { raw: 'legacy' });
    const object = new PostMirrorDO(state(sql), {} as any);
    const create = await makeEvent('create', 100, 'rev-1');

    const first = await (await object.fetch(new Request('https://do/event', {
      method: 'POST', body: JSON.stringify(create),
    }))).json();
    const replay = await (await object.fetch(new Request('https://do/event', {
      method: 'POST', body: JSON.stringify(create),
    }))).json();

    expect(first).toEqual(expect.objectContaining({ projected: true, duplicate: false }));
    expect(replay).toEqual(expect.objectContaining({ projected: false, duplicate: true, stale: false }));
    expect(sql.events.size).toBe(0);
    expect(sql.records.size).toBe(1);
    expect(sql.orders.size).toBe(1);
  });

  it('lists only the latest state for each record', async () => {
    const sql = new MirrorSQL();
    const object = new PostMirrorDO(state(sql), {} as any);
    const create = await makeEvent('create', 100, 'rev-1');
    const update = await makeEvent('update', 200, 'rev-2');
    await object.fetch(new Request('https://do/event', { method: 'POST', body: JSON.stringify(create) }));
    await object.fetch(new Request('https://do/event', { method: 'POST', body: JSON.stringify(update) }));

    const payload = await (await object.fetch(
      new Request('https://do/records?repo=did:plc:author'),
    )).json() as any;

    expect(payload).not.toHaveProperty('events');
    expect(payload.counts).toEqual({ records: 1, activeRecords: 1, deletedRecords: 0 });
    expect(payload.records).toHaveLength(1);
    expect(payload.records[0]).toEqual(expect.objectContaining({
      operation: 'update',
      timeUs: 200,
      value: { text: 'rev-2' },
    }));
  });

  it('reports numeric zero counts for an empty latest-state mirror', async () => {
    const object = new PostMirrorDO(state(new MirrorSQL()), {} as any);

    const payload = await (await object.fetch(new Request('https://do/status'))).json() as any;

    expect(payload.counts).toEqual({ records: 0, activeRecords: 0, deletedRecords: 0 });
  });

  it('stores the opaque PDS backfill cursor in the same DID-scoped object', async () => {
    const sql = new MirrorSQL();
    const object = new PostMirrorDO(state(sql), {} as any);
    const response = await object.fetch(new Request('https://do/backfill/checkpoint', {
      method: 'POST',
      body: JSON.stringify({ cursor: 'opaque-next-page', status: 'running', recordsProcessed: 25 }),
    }));
    expect(response.status).toBe(200);
    const result = await response.json() as { state: { cursor: string; records_processed: number } };
    expect(result.state).toEqual(expect.objectContaining({ cursor: 'opaque-next-page', records_processed: 25 }));
  });

  it('does not regress a legacy record that predates the ordering table', async () => {
    const sql = new MirrorSQL();
    const key = 'did:plc:author/uk.skyblur.post/post';
    sql.records.set(key, {
      repo: 'did:plc:author', collection: 'uk.skyblur.post', rkey: 'post',
      operation: 'update', cid: 'legacy-cid', rev: 'rev-3',
      event_time: 1_784_214_110_242, received_at: '2026-07-16T14:29:49.000Z',
      value_json: JSON.stringify({ text: 'legacy-newer' }),
    });
    const object = new PostMirrorDO(state(sql), {} as any);
    const olderReplay = await makeEvent('update', 1_784_214_110_241_000, 'rev-2');

    const result = await (await object.fetch(new Request('https://do/event', {
      method: 'POST', body: JSON.stringify(olderReplay),
    }))).json();

    expect(result).toEqual(expect.objectContaining({ accepted: true, projected: false, stale: true }));
    expect(sql.records.get(key)?.value_json).toBe(JSON.stringify({ text: 'legacy-newer' }));
  });

  it('normalizes the legacy millisecond watermark before comparing new events', async () => {
    const sql = new MirrorSQL();
    sql.meta.set('watermark', JSON.stringify({
      eventTime: 1_784_214_110_242,
      eventId: 'legacy-event',
      receivedAt: '2026-07-16T14:29:49.000Z',
    }));
    const object = new PostMirrorDO(state(sql), {} as any);
    const older = await makeEvent('create', 1_784_214_110_241_000, 'rev-1');

    await object.fetch(new Request('https://do/event', { method: 'POST', body: JSON.stringify(older) }));

    expect(JSON.parse(sql.meta.get('watermark') ?? '{}')).toEqual(expect.objectContaining({
      eventTime: 1_784_214_110_242,
      eventId: 'legacy-event',
    }));
  });

  it('rejects a record with an explicit mismatched lexicon type', async () => {
    const sql = new MirrorSQL();
    const object = new PostMirrorDO(state(sql), {} as any);
    const event = await makeEvent('create', 100, 'rev-1');
    event.commit.record = { $type: 'app.bsky.feed.post', text: 'wrong collection' };

    const response = await object.fetch(new Request('https://do/event', {
      method: 'POST', body: JSON.stringify(event),
    }));

    expect(response.status).toBe(400);
    expect(sql.records.size).toBe(0);
    expect(sql.orders.size).toBe(0);
  });

  it('dumps records, recordOrder, backfillState, and meta on /dump GET', async () => {
    const sql = new MirrorSQL();
    const object = new PostMirrorDO(state(sql), {} as any);
    const event = await makeEvent('create', 100, 'rev-1');

    await object.fetch(new Request('https://do/event', {
      method: 'POST',
      body: JSON.stringify(event),
    }));

    const dumpRes = await object.fetch(new Request('https://do/dump', { method: 'GET' }));
    expect(dumpRes.status).toBe(200);
    const dumpData = await dumpRes.json() as any;

    expect(dumpData.repo).toBe('did:plc:author');
    expect(dumpData.did).toBe('did:plc:author');
    expect(dumpData.records).toHaveLength(1);
    expect(dumpData.records[0].rkey).toBe('post');
    expect(dumpData.recordOrder).toHaveLength(1);
    expect(dumpData.recordOrder[0].source).toBe('jetstream');
    expect(Array.isArray(dumpData.backfillState)).toBe(true);
    expect(Array.isArray(dumpData.meta)).toBe(true);
  });
});
