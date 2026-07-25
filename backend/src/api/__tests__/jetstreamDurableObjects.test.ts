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
  inbox = new Map<string, {
    event_id: string; event_json: string; time_us: number; attempts: number;
    status: string; next_attempt_at: number; last_error?: string; projected_at?: number;
  }>();

  exec<T extends object>(query: string, ...args: unknown[]): Cursor<T> {
    const sql = query.replace(/\s+/g, ' ').trim();
    if (
      sql.startsWith('CREATE TABLE')
      || sql.startsWith('CREATE INDEX')
      || sql.startsWith('DROP INDEX')
    ) return new Cursor<T>();
    if (sql.startsWith("DELETE FROM inbox WHERE status = 'projected'")) {
      for (const [id, row] of this.inbox) {
        if (row.status === 'projected') this.inbox.delete(id);
      }
      return new Cursor<T>();
    }
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
    if (sql.startsWith('INSERT OR IGNORE INTO inbox')) {
      const id = String(args[0]);
      if (this.inbox.has(id)) return new Cursor<T>([], 0);
      this.inbox.set(id, {
        event_id: id,
        event_json: String(args[6]),
        time_us: Number(args[5]),
        attempts: 0,
        status: 'pending',
        next_attempt_at: 0,
      });
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
    if (sql.includes("FROM inbox WHERE status = 'pending'") && sql.startsWith('SELECT event_id')) {
      const rows = [...this.inbox.values()]
        .filter((row) => row.status === 'pending')
        .sort((a, b) => a.time_us - b.time_us || a.event_id.localeCompare(b.event_id))
        .slice(0, 25);
      return new Cursor<T>(rows as T[]);
    }
    if (sql === 'DELETE FROM inbox WHERE event_id = ?') {
      const deleted = this.inbox.delete(String(args[0]));
      return new Cursor<T>([], deleted ? 1 : 0);
    }
    if (sql.startsWith("UPDATE inbox SET status = 'dead_letter'")) {
      const row = this.inbox.get(String(args[1]));
      if (row) {
        row.status = 'dead_letter';
        row.attempts += 1;
        row.last_error = String(args[0]);
      }
      return new Cursor<T>([], row ? 1 : 0);
    }
    if (sql.startsWith("UPDATE inbox SET status = 'pending'")) {
      let changed = 0;
      for (const row of this.inbox.values()) {
        if (row.status === 'dead_letter') {
          row.status = 'pending';
          row.next_attempt_at = 0;
          row.last_error = undefined;
          changed += 1;
        }
      }
      return new Cursor<T>([], changed);
    }
    if (sql.startsWith('UPDATE inbox SET attempts = attempts + 1')) {
      const row = this.inbox.get(String(args[2]));
      if (row) {
        row.attempts += 1;
        row.next_attempt_at = Number(args[0]);
        row.last_error = String(args[1]);
      }
      return new Cursor<T>([], row ? 1 : 0);
    }
    if (sql.startsWith('SELECT SUM(CASE')) {
      const values = [...this.inbox.values()];
      return new Cursor<T>([{
        pending: values.filter((row) => row.status === 'pending').length,
        dead_letters: values.filter((row) => row.status === 'dead_letter').length,
      } as T]);
    }
    if (sql.startsWith('SELECT MIN(CASE')) {
      const values = [...this.inbox.values()];
      const pending = values.filter((row) => row.status === 'pending').map((row) => row.time_us);
      const dead = values.filter((row) => row.status === 'dead_letter').map((row) => row.time_us);
      return new Cursor<T>([{
        oldest_pending: pending.length > 0 ? Math.min(...pending) : null,
        oldest_dead_letter: dead.length > 0 ? Math.min(...dead) : null,
      } as T]);
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
    if (sql.startsWith('SELECT COUNT(*) AS count')) {
      return new Cursor<T>([{ count: [...this.inbox.values()].filter((row) => row.status === 'pending').length } as T]);
    }
    if (sql.startsWith('SELECT MIN(next_attempt_at)')) {
      const pending = [...this.inbox.values()].filter((row) => row.status === 'pending');
      const next = pending.length > 0 ? Math.min(...pending.map((row) => row.next_attempt_at)) : 0;
      return new Cursor<T>([{ next_attempt_at: next } as T]);
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
    if (sql.startsWith('SELECT operation, cid, rev')) {
      const row = this.records.get(`${args[0]}/${args[1]}/${args[2]}`);
      return new Cursor<T>(row ? [row as T] : []);
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
      setAlarm: vi.fn().mockResolvedValue(undefined),
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

  it('atomically stores the inbox and monotonically advances the durable cursor', async () => {
    const sql = new IngestSQL();
    const durableState = state(sql);
    const mirrorStub = { fetch: vi.fn().mockResolvedValue(Response.json({ accepted: true })) };
    const namespace = { idFromName: vi.fn().mockReturnValue('id'), get: vi.fn().mockReturnValue(mirrorStub) };
    const object = new JetstreamIngestDO(durableState, { SKYBLUR_DO_POST_MIRROR: namespace } as any);
    const item = await makeEvent('create', 200, 'rev-1');

    const first = await object.fetch(new Request('https://do/ingest', {
      method: 'POST', body: JSON.stringify({ cursor: 200, events: [item] }),
    }));
    expect(await first.json()).toEqual(expect.objectContaining({ committedCursor: 200, inserted: 1, duplicates: 0 }));
    const replay = await object.fetch(new Request('https://do/ingest', {
      method: 'POST', body: JSON.stringify({ cursor: 190, events: [item] }),
    }));
    expect(await replay.json()).toEqual(expect.objectContaining({ committedCursor: 200, inserted: 0, duplicates: 1 }));
    expect(durableState.storage.transactionSync).toHaveBeenCalledTimes(3);
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
    expect(current).toEqual(expect.objectContaining({ projectionHealthy: false, quarantinedFrames: 1 }));
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

  it('removes projected events immediately after the latest state is durable', async () => {
    const sql = new IngestSQL();
    const durableState = state(sql);
    const mirrorStub = { fetch: vi.fn().mockResolvedValue(Response.json({ accepted: true })) };
    const namespace = { idFromName: vi.fn().mockReturnValue('id'), get: vi.fn().mockReturnValue(mirrorStub) };
    const object = new JetstreamIngestDO(durableState, { SKYBLUR_DO_POST_MIRROR: namespace } as any);
    const item = await makeEvent('create', 200, 'rev-1');
    await object.fetch(new Request('https://do/ingest', {
      method: 'POST', body: JSON.stringify({ cursor: 200, events: [item] }),
    }));
    await object.alarm();
    expect(sql.inbox.has(item.eventId)).toBe(false);
    expect(mirrorStub.fetch).toHaveBeenCalledOnce();
    expect(durableState.storage.setAlarm).toHaveBeenCalledOnce();
  });

  it('removes legacy projected Inbox history without touching pending work', () => {
    const sql = new IngestSQL();
    sql.inbox.set('projected', {
      event_id: 'projected', event_json: '{}', time_us: 1, attempts: 0,
      status: 'projected', next_attempt_at: 0, projected_at: Date.now(),
    });
    sql.inbox.set('pending', {
      event_id: 'pending', event_json: '{}', time_us: 2, attempts: 0,
      status: 'pending', next_attempt_at: 0,
    });
    new JetstreamIngestDO(state(sql), { SKYBLUR_DO_POST_MIRROR: {} } as any);
    expect(sql.inbox.size).toBe(1);
    expect(sql.inbox.has('pending')).toBe(true);
  });

  it('keeps a rejected projection pending instead of creating a permanent mirror gap', async () => {
    const sql = new IngestSQL();
    const durableState = state(sql);
    const mirrorStub = { fetch: vi.fn().mockResolvedValue(Response.json({ error: 'invalid' }, { status: 400 })) };
    const namespace = { idFromName: vi.fn().mockReturnValue('id'), get: vi.fn().mockReturnValue(mirrorStub) };
    const object = new JetstreamIngestDO(durableState, { SKYBLUR_DO_POST_MIRROR: namespace } as any);
    const item = await makeEvent('create', 200, 'rev-1');
    await object.fetch(new Request('https://do/ingest', {
      method: 'POST', body: JSON.stringify({ cursor: 200, events: [item] }),
    }));
    await object.alarm();
    expect(sql.inbox.get(item.eventId)?.status).toBe('pending');
    expect(sql.inbox.get(item.eventId)?.last_error).toBe('mirror_400');
    expect(sql.inbox.get(item.eventId)?.next_attempt_at).toBeGreaterThan(Date.now());
  });

  it('keeps transient projection failures pending with bounded backoff', async () => {
    const sql = new IngestSQL();
    const durableState = state(sql);
    const mirrorStub = { fetch: vi.fn().mockResolvedValue(Response.json({ error: 'temporary' }, { status: 503 })) };
    const namespace = { idFromName: vi.fn().mockReturnValue('id'), get: vi.fn().mockReturnValue(mirrorStub) };
    const object = new JetstreamIngestDO(durableState, { SKYBLUR_DO_POST_MIRROR: namespace } as any);
    const item = await makeEvent('create', 200, 'rev-1');
    await object.fetch(new Request('https://do/ingest', {
      method: 'POST', body: JSON.stringify({ cursor: 200, events: [item] }),
    }));
    await object.alarm();
    const pending = sql.inbox.get(item.eventId);
    expect(pending?.status).toBe('pending');
    expect(pending?.attempts).toBe(1);
    expect(pending?.next_attempt_at).toBeGreaterThan(Date.now());
    expect(durableState.storage.setAlarm).toHaveBeenCalledTimes(2);
  });

  it('reports the oldest projection gap and can requeue legacy dead letters', async () => {
    const sql = new IngestSQL();
    sql.inbox.set('dead', {
      event_id: 'dead', event_json: '{}', time_us: 123, attempts: 1,
      status: 'dead_letter', next_attempt_at: 0, last_error: 'legacy_failure',
    });
    const durableState = state(sql);
    const namespace = { idFromName: vi.fn(), get: vi.fn() };
    const object = new JetstreamIngestDO(durableState, { SKYBLUR_DO_POST_MIRROR: namespace } as any);

    const before = await (await object.fetch(new Request('https://do/state'))).json() as any;
    expect(before).toEqual(expect.objectContaining({ projectionHealthy: false }));
    expect(before.queue).toEqual(expect.objectContaining({ deadLetters: 1, oldestDeadLetterTimeUs: 123 }));

    const response = await object.fetch(new Request('https://do/requeue', { method: 'POST' }));
    expect(await response.json()).toEqual({ accepted: true, requeued: 1 });
    expect(sql.inbox.get('dead')?.status).toBe('pending');
    expect(durableState.storage.setAlarm).toHaveBeenCalledOnce();
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
    expect(durableState.storage.transactionSync).toHaveBeenCalledTimes(4);
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
});
