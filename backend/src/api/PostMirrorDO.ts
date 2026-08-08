import { DurableObject } from 'cloudflare:workers';
import type { JetstreamEvent } from './jetstream';
import type { Env } from '@/index';

type ProjectionSource = 'jetstream' | 'pds' | 'backfill';
type MirrorEvent = JetstreamEvent & { source?: ProjectionSource };
type RecordOrder = {
  source: ProjectionSource;
  time_us: number;
  rev: string;
  operation: string;
  event_id: string;
};
type StoredRecordRow = {
  repo: string;
  collection: string;
  rkey: string;
  operation: string;
  cid: string | null;
  rev: string | null;
  event_time: number;
  received_at: string;
  value_json: string | null;
};
type LegacyRecordOrder = {
  operation: string;
  rev: string | null;
  event_time: number;
};

export function compareProjectionOrder(incoming: RecordOrder, current: RecordOrder): number {
  if (incoming.source !== current.source) {
    if (incoming.source === 'backfill') return -1;
    if (current.source === 'backfill') return 1;
    if (incoming.time_us !== current.time_us) return incoming.time_us > current.time_us ? 1 : -1;
    return incoming.source === 'jetstream' ? 1 : -1;
  }
  if (incoming.time_us !== current.time_us) return incoming.time_us > current.time_us ? 1 : -1;
  if (incoming.rev !== current.rev) return incoming.rev > current.rev ? 1 : -1;
  const priority: Record<string, number> = { create: 1, update: 2, delete: 3 };
  if (incoming.operation !== current.operation) {
    return (priority[incoming.operation] ?? 0) > (priority[current.operation] ?? 0) ? 1 : -1;
  }
  if (incoming.event_id === current.event_id) return 0;
  return incoming.event_id > current.event_id ? 1 : -1;
}

export class PostMirrorDO extends DurableObject<Env> {
  private readonly initializedAt = performance.now();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS records (
        repo TEXT NOT NULL, collection TEXT NOT NULL, rkey TEXT NOT NULL,
        operation TEXT NOT NULL, cid TEXT, rev TEXT, event_time INTEGER,
        received_at TEXT NOT NULL, value_json TEXT, PRIMARY KEY (repo, collection, rkey)
      );
      CREATE TABLE IF NOT EXISTS record_order (
        repo TEXT NOT NULL, collection TEXT NOT NULL, rkey TEXT NOT NULL,
        source TEXT NOT NULL, time_us INTEGER NOT NULL, rev TEXT NOT NULL,
        operation TEXT NOT NULL, event_id TEXT NOT NULL,
        PRIMARY KEY (repo, collection, rkey)
      );
      CREATE TABLE IF NOT EXISTS backfill_state (
        collection TEXT PRIMARY KEY, cursor TEXT, status TEXT NOT NULL,
        records_processed INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, last_error TEXT
      );
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
    const storageModelVersion = Number(
      this.ctx.storage.sql.exec<{ value: string }>(
        'SELECT value FROM meta WHERE key = ?', 'storageModelVersion',
      ).toArray()[0]?.value ?? 0,
    );
    if (storageModelVersion < 2) {
      this.ctx.storage.transactionSync(() => {
        this.ctx.storage.sql.exec('DROP TABLE IF EXISTS events');
        this.ctx.storage.sql.exec(
          `INSERT INTO meta (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          'storageModelVersion', '2',
        );
      });
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/event') {
      const event = await request.json() as MirrorEvent;
      if (!this.validEvent(event)) return Response.json({ error: 'Invalid mirror event' }, { status: 400 });
      return Response.json(this.project(event));
    }


    if (request.method === 'GET' && url.pathname === '/record') {
      const startedAt = performance.now();
      const repo = url.searchParams.get('repo');
      const rkey = url.searchParams.get('rkey');
      if (!repo || !rkey) return new Response('Missing repo or rkey', { status: 400 });
      const row = this.ctx.storage.sql.exec<{
        operation: string; cid?: string; rev?: string; event_time?: number;
        received_at: string; value_json?: string | null; source?: ProjectionSource | null; event_id?: string;
      }>(
        `SELECT r.operation, r.cid, r.rev, r.event_time, r.received_at, r.value_json, o.source, o.event_id
         FROM records AS r
         LEFT JOIN record_order AS o
           ON o.repo = r.repo AND o.collection = r.collection AND o.rkey = r.rkey
         WHERE r.repo = ? AND r.collection = ? AND r.rkey = ?`,
        repo, 'uk.skyblur.post', rkey,
      ).toArray()[0];
      if (!row) return new Response(null, { status: 404 });
      if (row.operation === 'delete') return new Response(null, { status: 410 });
      if (!row.value_json) return new Response(null, { status: 404 });
      const timing = {
        sqlMs: Number((performance.now() - startedAt).toFixed(1)),
        durationMs: Number((performance.now() - startedAt).toFixed(1)),
        instanceAgeMs: Number((performance.now() - this.initializedAt).toFixed(1)),
      };
      console.info('[PostMirrorDO] record', { repo, rkey, ...timing });
      return Response.json({
        value: JSON.parse(row.value_json), cid: row.cid, rev: row.rev,
        timeUs: row.event_time, receivedAt: row.received_at, source: row.source ?? undefined,
        pdsGeneration: row.source === 'pds' && row.event_id?.startsWith('pds:v2:') ? 'v2' : undefined,
      }, { headers: { 'X-Skyblur-Mirror-DO-Timing': JSON.stringify(timing) } });
    }

    if (request.method === 'GET' && url.pathname === '/records') return this.records(url);
    if (request.method === 'GET' && url.pathname === '/status') return Response.json(this.status());
    if (request.method === 'GET' && url.pathname === '/backfill/state') return Response.json(this.backfillState());
    if (request.method === 'POST' && url.pathname === '/backfill/checkpoint') {
      return this.updateBackfillCheckpoint(await request.json());
    }
    return new Response('Not found', { status: 404 });
  }

  private validEvent(event: MirrorEvent): boolean {
    return !!event
      && typeof event.eventId === 'string'
      && typeof event.did === 'string'
      && Number.isSafeInteger(event.timeUs)
      && event.timeUs >= 0
      && event.kind === 'commit'
      && event.commit?.collection === 'uk.skyblur.post'
      && typeof event.commit.rkey === 'string'
      && event.commit.rkey.length > 0
      && ['create', 'update', 'delete'].includes(event.commit.operation)
      && (event.commit.operation === 'delete'
        || event.commit.record !== null
        && typeof event.commit.record === 'object'
        && !Array.isArray(event.commit.record))
      && (event.commit.operation === 'delete'
        || typeof event.commit.record !== 'object'
        || event.commit.record === null
        || !('$type' in event.commit.record)
        || event.commit.record.$type === 'uk.skyblur.post')
      && (!event.source || ['jetstream', 'pds', 'backfill'].includes(event.source));
  }

  private project(event: MirrorEvent) {
    const source = event.source ?? 'jetstream';
    const receivedAt = new Date().toISOString();
    return this.ctx.storage.transactionSync(() => {
      let current = this.ctx.storage.sql.exec<RecordOrder>(
        `SELECT source, time_us, rev, operation, event_id FROM record_order
         WHERE repo = ? AND collection = ? AND rkey = ?`,
        event.did, event.commit.collection, event.commit.rkey,
      ).toArray()[0];
      if (!current) {
        const legacy = this.ctx.storage.sql.exec<LegacyRecordOrder>(
          `SELECT operation, rev, event_time FROM records
           WHERE repo = ? AND collection = ? AND rkey = ?`,
          event.did, event.commit.collection, event.commit.rkey,
        ).toArray()[0];
        if (legacy) {
          const legacyTimeUs = legacy.event_time < 100_000_000_000_000
            ? legacy.event_time * 1_000
            : legacy.event_time;
          current = {
            source: 'jetstream',
            time_us: legacyTimeUs,
            rev: legacy.rev ?? '',
            operation: legacy.operation,
            event_id: `legacy:${event.did}:${event.commit.rkey}:${legacy.rev ?? legacyTimeUs}`,
          };
        }
      }
      const incoming: RecordOrder = {
        source,
        time_us: event.timeUs,
        rev: event.commit.rev ?? '',
        operation: event.commit.operation,
        event_id: event.eventId,
      };
      const order = current ? compareProjectionOrder(incoming, current) : 1;
      const stale = order < 0;
      const duplicate = order === 0;

      if (order > 0) {
        this.ctx.storage.sql.exec(
          `INSERT INTO records (repo, collection, rkey, operation, cid, rev, event_time, received_at, value_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(repo, collection, rkey) DO UPDATE SET
             operation=excluded.operation, cid=excluded.cid, rev=excluded.rev,
             event_time=excluded.event_time, received_at=excluded.received_at, value_json=excluded.value_json`,
          event.did, event.commit.collection, event.commit.rkey, event.commit.operation,
          event.commit.cid ?? null, event.commit.rev ?? null, event.timeUs, receivedAt,
          event.commit.operation === 'delete' ? null : JSON.stringify(event.commit.record),
        );
        this.ctx.storage.sql.exec(
          `INSERT INTO record_order (repo, collection, rkey, source, time_us, rev, operation, event_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(repo, collection, rkey) DO UPDATE SET
             source=excluded.source, time_us=excluded.time_us, rev=excluded.rev,
             operation=excluded.operation, event_id=excluded.event_id`,
          event.did, event.commit.collection, event.commit.rkey, source,
          event.timeUs, event.commit.rev ?? '', event.commit.operation, event.eventId,
        );
        const watermark = this.watermark();
        if (source === 'jetstream' && (!watermark || event.timeUs > watermark.timeUs)) {
          this.ctx.storage.sql.exec(
            "INSERT INTO meta (key, value) VALUES ('watermark', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            JSON.stringify({ timeUs: event.timeUs, eventId: event.eventId, receivedAt }),
          );
        }
      }
      return { accepted: true, duplicate, stale, projected: order > 0 };
    });
  }

  private records(url: URL): Response {
    const repo = url.searchParams.get('repo');
    if (!repo) return new Response('Missing repo', { status: 400 });
    const records = this.ctx.storage.sql.exec<StoredRecordRow>(
      `SELECT repo, collection, rkey, operation, cid, rev, event_time, received_at, value_json
       FROM records WHERE repo = ? ORDER BY event_time DESC, received_at DESC, rkey DESC`,
      repo,
    ).toArray();
    return Response.json({
      repo,
      watermark: this.watermark(),
      backfill: this.backfillState(),
      counts: {
        records: records.length,
        activeRecords: records.filter((row) => row.operation !== 'delete').length,
        deletedRecords: records.filter((row) => row.operation === 'delete').length,
      },
      records: records.map((row) => ({
        repo: row.repo, collection: row.collection, rkey: row.rkey,
        uri: `at://${row.repo}/${row.collection}/${row.rkey}`,
        operation: row.operation, deleted: row.operation === 'delete', cid: row.cid, rev: row.rev,
        timeUs: row.event_time, receivedAt: row.received_at,
        value: row.value_json ? JSON.parse(row.value_json) : null,
      })),
    });
  }


  private status() {
    const counts = this.ctx.storage.sql.exec<{
      records: number;
      activeRecords: number;
      deletedRecords: number;
    }>(
      `SELECT COUNT(*) AS records,
        COALESCE(SUM(CASE WHEN operation != 'delete' THEN 1 ELSE 0 END), 0) AS activeRecords,
        COALESCE(SUM(CASE WHEN operation = 'delete' THEN 1 ELSE 0 END), 0) AS deletedRecords
       FROM records`,
    ).toArray()[0] ?? { records: 0, activeRecords: 0, deletedRecords: 0 };
    return { watermark: this.watermark(), backfill: this.backfillState(), counts };
  }

  private watermark(): { timeUs: number; eventId: string; receivedAt: string } | null {
    const row = this.ctx.storage.sql.exec<{ value: string }>("SELECT value FROM meta WHERE key = 'watermark'").toArray()[0];
    if (!row?.value) return null;
    const stored = JSON.parse(row.value) as { timeUs?: number; eventTime?: number; eventId?: string; receivedAt?: string };
    const rawTime = stored.timeUs ?? stored.eventTime;
    if (!Number.isSafeInteger(rawTime)) return null;
    const timeUs = Number(rawTime) < 100_000_000_000_000 ? Number(rawTime) * 1_000 : Number(rawTime);
    return { timeUs, eventId: stored.eventId ?? 'legacy', receivedAt: stored.receivedAt ?? '' };
  }

  private backfillState() {
    return this.ctx.storage.sql.exec<{
      cursor: string | null; status: string; records_processed: number; updated_at: string; last_error: string | null;
    }>(
      'SELECT cursor, status, records_processed, updated_at, last_error FROM backfill_state WHERE collection = ?',
      'uk.skyblur.post',
    ).toArray()[0] ?? null;
  }

  private updateBackfillCheckpoint(raw: unknown): Response {
    if (!raw || typeof raw !== 'object') return Response.json({ error: 'Invalid checkpoint' }, { status: 400 });
    const checkpoint = raw as { cursor?: unknown; status?: unknown; recordsProcessed?: unknown; error?: unknown };
    if (
      checkpoint.cursor !== null && checkpoint.cursor !== undefined && typeof checkpoint.cursor !== 'string'
      || !['pending', 'running', 'completed', 'failed'].includes(String(checkpoint.status))
      || !Number.isSafeInteger(checkpoint.recordsProcessed) || Number(checkpoint.recordsProcessed) < 0
      || checkpoint.error !== undefined && checkpoint.error !== null && typeof checkpoint.error !== 'string'
    ) return Response.json({ error: 'Invalid checkpoint' }, { status: 400 });

    const updatedAt = new Date().toISOString();
    this.ctx.storage.transactionSync(() => {
      this.ctx.storage.sql.exec(
        `INSERT INTO backfill_state (collection, cursor, status, records_processed, updated_at, last_error)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(collection) DO UPDATE SET cursor=excluded.cursor, status=excluded.status,
           records_processed=excluded.records_processed, updated_at=excluded.updated_at, last_error=excluded.last_error`,
        'uk.skyblur.post', checkpoint.cursor ?? null, checkpoint.status,
        checkpoint.recordsProcessed, updatedAt,
        typeof checkpoint.error === 'string' ? checkpoint.error.slice(0, 512) : null,
      );
    });
    return Response.json({ accepted: true, state: this.backfillState() });
  }
}
