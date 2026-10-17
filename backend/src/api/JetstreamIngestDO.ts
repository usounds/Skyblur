import { DurableObject } from 'cloudflare:workers';
import type { Env } from '@/index';
import type { JetstreamBatch, JetstreamEvent } from './jetstream';

// Signatures permit five minutes of future skew plus five minutes of age.
const RECEIPT_TTL_MS = 11 * 60_000;
const MAX_RECEIPTS = 4096;
const MAX_IN_FLIGHT = 64;
type IngestResult = { body: string; status: number };

const MAX_FUTURE_CURSOR_US = 5 * 60 * 1_000_000;

export class JetstreamIngestDO extends DurableObject<Env> {
  private readonly inFlight = new Map<string, Promise<IngestResult>>();
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS quarantined_frames (
        hash TEXT PRIMARY KEY,
        time_us INTEGER NOT NULL,
        reason TEXT NOT NULL,
        did TEXT,
        collection TEXT,
        rkey TEXT,
        created_at INTEGER NOT NULL,
        resolution TEXT,
        resolved_at INTEGER,
        remediated_by TEXT
      );
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ingest_receipts (
        request_id TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, response_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ingest_receipts_expiry ON ingest_receipts(expires_at);
    `);
    this.ensureQuarantineSchema();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/ingest') {
      const requestId = request.headers.get('x-skyblur-ingest-id');
      if (!requestId) return this.applyBatch(request);
      if (!/^[0-9a-f]{64}$/.test(requestId)) {
        void request.body?.cancel().catch(() => {});
        return Response.json({ error: 'Invalid request ID' }, { status: 400 });
      }
      this.ctx.storage.sql.exec('DELETE FROM ingest_receipts WHERE expires_at <= ?', Date.now());
      const cached = this.ctx.storage.sql.exec<{ response_json: string }>(
        'SELECT response_json FROM ingest_receipts WHERE request_id = ?', requestId,
      ).toArray()[0];
      if (cached) {
        void request.body?.cancel().catch(() => {});
        return new Response(cached.response_json, { headers: { 'Content-Type': 'application/json' } });
      }
      const existing = this.inFlight.get(requestId);
      if (existing) {
        void request.body?.cancel().catch(() => {});
        return this.resultResponse(await existing);
      }
      const count = this.ctx.storage.sql.exec<{ count: number }>('SELECT COUNT(*) AS count FROM ingest_receipts').toArray()[0]?.count ?? 0;
      if (this.inFlight.size >= MAX_IN_FLIGHT || count + this.inFlight.size >= MAX_RECEIPTS) {
        void request.body?.cancel().catch(() => {});
        return Response.json({ error: 'Ingest capacity temporarily exceeded' }, { status: 503 });
      }
      const processing = this.applyBatch(request, requestId).then(async (response) => ({
        body: await response.text(), status: response.status,
      }));
      this.inFlight.set(requestId, processing);
      try { return this.resultResponse(await processing); }
      finally { this.inFlight.delete(requestId); }
    }

    if (request.method === 'GET' && url.pathname === '/state') {
      return Response.json(this.state());
    }
    if (request.method === 'POST' && url.pathname === '/quarantine/resolve') {
      const body = await request.json() as {
        hash?: unknown; resolution?: unknown; remediatedBy?: unknown;
      };
      if (
        typeof body.hash !== 'string'
        || !/^[0-9a-f]{64}$/.test(body.hash)
        || !['backfilled', 'replayed', 'ignored'].includes(String(body.resolution))
        || typeof body.remediatedBy !== 'string'
        || body.remediatedBy.length < 1
        || body.remediatedBy.length > 256
      ) {
        return Response.json({ error: 'Invalid quarantine resolution' }, { status: 400 });
      }
      const result = this.ctx.storage.sql.exec(
        `UPDATE quarantined_frames SET resolution = ?, resolved_at = ?, remediated_by = ?
         WHERE hash = ? AND resolution IS NULL`,
        body.resolution, Date.now(), body.remediatedBy, body.hash,
      );
      console.info(JSON.stringify({
        event: 'jetstream_quarantine_resolution', hash: body.hash,
        resolution: body.resolution, remediatedBy: body.remediatedBy, updated: result.rowsWritten,
      }));
      return Response.json({ accepted: true, resolved: result.rowsWritten });
    }
    return new Response('Not found', { status: 404 });
  }

  private resultResponse(result: IngestResult) {
    return new Response(result.body, { status: result.status, headers: { 'Content-Type': 'application/json' } });
  }

  private async applyBatch(request: Request, requestId?: string): Promise<Response> {
    const batch = await request.json() as JetstreamBatch;
    if (
      !Number.isSafeInteger(batch.cursor)
      || batch.cursor < 0
      || batch.cursor > Date.now() * 1_000 + MAX_FUTURE_CURSOR_US
      || !Array.isArray(batch.events)
    ) {
      return Response.json({ error: 'Invalid batch' }, { status: 400 });
    }

    let projection: { projected: number; duplicates: number; stale: number };
    try {
      projection = await this.projectEvents(batch.events);
    } catch (error) {
      console.error(JSON.stringify({
        event: 'jetstream_projection_failed',
        message: error instanceof Error ? error.message.slice(0, 512) : 'projection_failed',
      }));
      return Response.json({ error: 'Failed to apply Jetstream batch' }, { status: 503 });
    }

    const result = this.ctx.storage.transactionSync(() => {
      const stored = this.metaNumber('committedCursor');
      let quarantined = 0;
      for (const item of batch.quarantined ?? []) {
        const write = this.ctx.storage.sql.exec(
          `INSERT OR IGNORE INTO quarantined_frames
            (hash, time_us, reason, did, collection, rkey, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          item.hash, item.cursor, item.reason, item.did ?? null,
          item.collection ?? null, item.rkey ?? null, Date.now(),
        );
        quarantined += write.rowsWritten;
      }
      const committedCursor = Math.max(stored, batch.cursor);
      this.setMetaNumber('committedCursor', committedCursor);
      this.setMetaNumber('lastIngestedAt', Date.now());
      const result = {
        accepted: true, committedCursor, quarantined,
        quarantineDuplicates: (batch.quarantined?.length ?? 0) - quarantined,
        ...projection,
      };
      if (requestId) this.ctx.storage.sql.exec(
        'INSERT INTO ingest_receipts (request_id, expires_at, response_json) VALUES (?, ?, ?)',
        requestId, Date.now() + RECEIPT_TTL_MS, JSON.stringify(result),
      );
      return result;
    });

    console.info(JSON.stringify({
      event: 'jetstream_ingest',
      committedCursor: result.committedCursor,
      events: batch.events.length,
      projected: projection.projected,
      duplicates: projection.duplicates,
      stale: projection.stale,
      quarantined: result.quarantined,
      quarantineDuplicates: result.quarantineDuplicates,
    }));
    return Response.json(result);
  }

  private state() {
    const quarantineCounts = this.ctx.storage.sql.exec<{
      total: number; unresolved: number; ignored: number;
    }>(
      `SELECT COUNT(*) AS total,
        SUM(CASE WHEN resolution IS NULL THEN 1 ELSE 0 END) AS unresolved,
        SUM(CASE WHEN resolution = 'ignored' THEN 1 ELSE 0 END) AS ignored
       FROM quarantined_frames`,
    ).toArray()[0] ?? { total: 0, unresolved: 0, ignored: 0 };
    const recentQuarantines = this.ctx.storage.sql.exec<{
      hash: string; time_us: number; reason: string; did: string | null;
      collection: string | null; rkey: string | null; created_at: number;
      resolution: string | null; resolved_at: number | null; remediated_by: string | null;
    }>(
      `SELECT hash, time_us, reason, did, collection, rkey, created_at,
        resolution, resolved_at, remediated_by
       FROM quarantined_frames ORDER BY time_us DESC LIMIT 20`,
    ).toArray();
    const unhealthyQuarantines = Number(quarantineCounts.unresolved ?? 0) + Number(quarantineCounts.ignored ?? 0);
    return {
      committedCursor: this.metaNumber('committedCursor'),
      lastIngestedAt: this.metaNumber('lastIngestedAt') || null,
      projectionMode: 'synchronous',
      projectionHealthy: unhealthyQuarantines === 0,
      quarantinedFrames: Number(quarantineCounts.total ?? 0),
      unresolvedQuarantines: Number(quarantineCounts.unresolved ?? 0),
      ignoredQuarantines: Number(quarantineCounts.ignored ?? 0),
      recentQuarantines: recentQuarantines.map((row) => ({
        hash: row.hash, timeUs: row.time_us, reason: row.reason,
        did: row.did, collection: row.collection, rkey: row.rkey, createdAt: row.created_at,
        resolution: row.resolution, resolvedAt: row.resolved_at, remediatedBy: row.remediated_by,
      })),
    };
  }

  private async projectEvents(events: JetstreamEvent[]) {
    let projected = 0;
    let duplicates = 0;
    let stale = 0;
    for (const event of events) {
      const namespace = this.env.SKYBLUR_DO_POST_MIRROR;
      const stub = namespace.get(namespace.idFromName(event.did));
      const response = await stub.fetch('https://mirror/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });
      if (!response.ok) throw new Error(`mirror_${response.status}:${event.eventId}`);
      const result = await response.json() as {
        accepted?: boolean; projected?: boolean; duplicate?: boolean; stale?: boolean;
      };
      if (result.accepted !== true) throw new Error(`mirror_not_accepted:${event.eventId}`);
      if (result.projected === true) projected += 1;
      if (result.duplicate === true) duplicates += 1;
      if (result.stale === true) stale += 1;
    }
    return { projected, duplicates, stale };
  }

  private metaNumber(key: string): number {
    const row = this.ctx.storage.sql.exec<{ value: string }>('SELECT value FROM meta WHERE key = ?', key).toArray()[0];
    const value = Number(row?.value ?? 0);
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  }

  private ensureQuarantineSchema() {
    const existing = new Set(
      this.ctx.storage.sql.exec<{ name: string }>('PRAGMA table_info(quarantined_frames)')
        .toArray()
        .map((column) => column.name),
    );
    const additions = [
      ['did', 'TEXT'],
      ['collection', 'TEXT'],
      ['rkey', 'TEXT'],
      ['resolution', 'TEXT'],
      ['resolved_at', 'INTEGER'],
      ['remediated_by', 'TEXT'],
    ] as const;
    for (const [name, type] of additions) {
      if (!existing.has(name)) {
        this.ctx.storage.sql.exec(`ALTER TABLE quarantined_frames ADD COLUMN ${name} ${type}`);
      }
    }
  }

  private setMetaNumber(key: string, value: number) {
    this.ctx.storage.sql.exec(
      'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      key, String(value),
    );
  }
}
