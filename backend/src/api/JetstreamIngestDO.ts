import { DurableObject } from 'cloudflare:workers';
import type { Env } from '@/index';
import type { JetstreamBatch, JetstreamEvent } from './jetstream';

type InboxRow = {
  event_id: string;
  event_json: string;
  time_us: number;
  attempts: number;
};

const MAX_FUTURE_CURSOR_US = 5 * 60 * 1_000_000;

export class JetstreamIngestDO extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS inbox (
        event_id TEXT PRIMARY KEY,
        did TEXT NOT NULL,
        collection TEXT NOT NULL,
        rkey TEXT NOT NULL,
        operation TEXT NOT NULL,
        time_us INTEGER NOT NULL,
        event_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at INTEGER NOT NULL,
        projected_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS inbox_status_time ON inbox(status, time_us, event_id);
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
    `);
    if (this.metaNumber('storageModelVersion') < 2) {
      this.ctx.storage.transactionSync(() => {
        this.ctx.storage.sql.exec("DELETE FROM inbox WHERE status = 'projected'");
        this.ctx.storage.sql.exec('DROP INDEX IF EXISTS inbox_status_projected');
        this.setMetaNumber('storageModelVersion', 2);
      });
    }
    this.ensureQuarantineSchema();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/ingest') {
      const batch = await request.json() as JetstreamBatch;
      if (
        !Number.isSafeInteger(batch.cursor)
        || batch.cursor < 0
        || batch.cursor > Date.now() * 1_000 + MAX_FUTURE_CURSOR_US
        || !Array.isArray(batch.events)
      ) {
        return Response.json({ error: 'Invalid batch' }, { status: 400 });
      }

      const result = this.ctx.storage.transactionSync(() => {
        const stored = this.metaNumber('committedCursor');
        let inserted = 0;
        for (const event of batch.events) {
          const write = this.ctx.storage.sql.exec(
            `INSERT OR IGNORE INTO inbox
              (event_id, did, collection, rkey, operation, time_us, event_json, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            event.eventId,
            event.did,
            event.commit.collection,
            event.commit.rkey,
            event.commit.operation,
            event.timeUs,
            JSON.stringify(event),
            Date.now(),
          );
          inserted += write.rowsWritten;
        }
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
        return {
          committedCursor,
          inserted,
          duplicates: batch.events.length - inserted,
          quarantined,
          quarantineDuplicates: (batch.quarantined?.length ?? 0) - quarantined,
        };
      });

      if (batch.events.length > 0) await this.ctx.storage.setAlarm(Date.now());
      console.info(JSON.stringify({
        event: 'jetstream_ingest',
        committedCursor: result.committedCursor,
        events: batch.events.length,
        inserted: result.inserted,
        duplicates: result.duplicates,
        quarantined: result.quarantined,
        quarantineDuplicates: result.quarantineDuplicates,
      }));
      return Response.json({ accepted: true, ...result });
    }

    if (request.method === 'GET' && url.pathname === '/state') {
      return Response.json(this.state());
    }
    if (request.method === 'POST' && url.pathname === '/requeue') {
      const result = this.ctx.storage.sql.exec(
        "UPDATE inbox SET status = 'pending', next_attempt_at = 0, last_error = NULL WHERE status = 'dead_letter'",
      );
      if (result.rowsWritten > 0) await this.ctx.storage.setAlarm(Date.now());
      return Response.json({ accepted: true, requeued: result.rowsWritten });
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

  async alarm(): Promise<void> {
    try {
      const rows = this.ctx.storage.sql.exec<InboxRow>(
        `SELECT event_id, event_json, time_us, attempts
         FROM inbox WHERE status = 'pending' AND next_attempt_at <= ?
         ORDER BY time_us ASC, event_id ASC LIMIT 25`,
        Date.now(),
      ).toArray();

      for (const row of rows) {
        const event = JSON.parse(row.event_json) as JetstreamEvent;
        try {
          const namespace = this.env.SKYBLUR_DO_POST_MIRROR;
          const stub = namespace.get(namespace.idFromName(event.did));
          const response = await stub.fetch('https://mirror/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event),
          });
          if (!response.ok) throw new Error(`mirror_${response.status}`);
          const result = await response.json() as { accepted?: boolean };
          if (result.accepted !== true) throw new Error('mirror_not_accepted');
          this.ctx.storage.transactionSync(() => {
            this.ctx.storage.sql.exec(
              'DELETE FROM inbox WHERE event_id = ?',
              row.event_id,
            );
            const projected = this.metaNumber('projectedTimeUs');
            if (row.time_us > projected) this.setMetaNumber('projectedTimeUs', row.time_us);
          });
        } catch (error) {
          const message = error instanceof Error ? error.message.slice(0, 512) : 'projection_failed';
          const delay = Math.min(2 ** Math.min(row.attempts + 1, 8) * 1_000, 5 * 60 * 1_000);
          this.ctx.storage.sql.exec(
            'UPDATE inbox SET attempts = attempts + 1, next_attempt_at = ?, last_error = ? WHERE event_id = ?',
            Date.now() + delay, message, row.event_id,
          );
        }
      }
    } finally {
      const nextAlarm = this.nextMaintenanceAlarm();
      if (nextAlarm !== null) await this.ctx.storage.setAlarm(nextAlarm);
    }
  }

  private state() {
    const counts = this.ctx.storage.sql.exec<{ pending: number; dead_letters: number }>(
      `SELECT
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'dead_letter' THEN 1 ELSE 0 END) AS dead_letters
       FROM inbox`,
    ).toArray()[0] ?? { pending: 0, dead_letters: 0 };
    const oldest = this.ctx.storage.sql.exec<{ oldest_pending: number | null; oldest_dead_letter: number | null }>(
      `SELECT
        MIN(CASE WHEN status = 'pending' THEN time_us END) AS oldest_pending,
        MIN(CASE WHEN status = 'dead_letter' THEN time_us END) AS oldest_dead_letter
       FROM inbox`,
    ).toArray()[0];
    const pending = Number(counts.pending ?? 0);
    const deadLetters = Number(counts.dead_letters ?? 0);
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
      projectedTimeUs: this.metaNumber('projectedTimeUs'),
      lastIngestedAt: this.metaNumber('lastIngestedAt') || null,
      projectionHealthy: pending === 0 && deadLetters === 0 && unhealthyQuarantines === 0,
      quarantinedFrames: Number(quarantineCounts.total ?? 0),
      unresolvedQuarantines: Number(quarantineCounts.unresolved ?? 0),
      ignoredQuarantines: Number(quarantineCounts.ignored ?? 0),
      recentQuarantines: recentQuarantines.map((row) => ({
        hash: row.hash, timeUs: row.time_us, reason: row.reason,
        did: row.did, collection: row.collection, rkey: row.rkey, createdAt: row.created_at,
        resolution: row.resolution, resolvedAt: row.resolved_at, remediatedBy: row.remediated_by,
      })),
      queue: {
        pending,
        deadLetters,
        oldestPendingTimeUs: oldest?.oldest_pending ?? null,
        oldestDeadLetterTimeUs: oldest?.oldest_dead_letter ?? null,
      },
    };
  }

  private pendingCount(): number {
    const row = this.ctx.storage.sql.exec<{ count: number }>(
      "SELECT COUNT(*) AS count FROM inbox WHERE status = 'pending'",
    ).toArray()[0];
    return Number(row?.count ?? 0);
  }

  private nextPendingAt(): number {
    const row = this.ctx.storage.sql.exec<{ next_attempt_at: number }>(
      "SELECT MIN(next_attempt_at) AS next_attempt_at FROM inbox WHERE status = 'pending'",
    ).toArray()[0];
    return Number(row?.next_attempt_at ?? Date.now() + 2_000);
  }

  private nextMaintenanceAlarm(): number | null {
    const now = Date.now();
    return this.pendingCount() > 0 ? Math.max(now + 100, this.nextPendingAt()) : null;
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
