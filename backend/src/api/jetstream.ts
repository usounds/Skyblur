import type { Context } from 'hono';
import type { Env } from '@/index';

export const MAX_INGEST_BODY_BYTES = 2 * 1024 * 1024;
const MAX_BATCH_EVENTS = 20;
const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;
const MAX_FUTURE_CURSOR_US = 5 * 60 * 1_000_000;

export type JetstreamCommit = {
  rev?: string;
  operation: 'create' | 'update' | 'delete';
  collection: 'uk.skyblur.post';
  rkey: string;
  cid?: string;
  record?: unknown;
};

export type JetstreamEvent = {
  eventId: string;
  did: string;
  timeUs: number;
  kind: 'commit';
  commit: JetstreamCommit;
};

export type JetstreamBatch = {
  cursor: number;
  events: JetstreamEvent[];
  quarantined?: JetstreamQuarantine[];
};

export type JetstreamQuarantine = {
  cursor: number;
  hash: string;
  reason: 'invalid_envelope' | 'invalid_commit' | 'invalid_record';
  did?: string;
  collection?: string;
  rkey?: string;
};

function safeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(body: Uint8Array): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', body)));
}

export async function canonicalEventId(event: Omit<JetstreamEvent, 'eventId'>): Promise<string> {
  const parts = [
    event.did,
    event.commit.collection,
    event.commit.rkey,
    event.commit.operation,
    event.commit.rev ?? '',
    event.commit.cid ?? '',
  ];
  if (!event.commit.rev) parts.push(String(event.timeUs));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts.join('\n')));
  return `jetstream:${toHex(new Uint8Array(digest))}`;
}

export async function verifySignedRequest(
  request: Request,
  body: Uint8Array,
  secret: string | undefined,
  now = Date.now(),
): Promise<boolean> {
  if (!secret) return false;
  const timestamp = request.headers.get('x-skyblur-timestamp');
  const supplied = request.headers.get('x-skyblur-signature');
  if (!timestamp || !supplied?.startsWith('sha256=')) return false;
  const timestampMs = Date.parse(timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(now - timestampMs) > SIGNATURE_MAX_AGE_MS) return false;

  const signatureHex = supplied.slice('sha256='.length);
  if (!/^[0-9a-f]{64}$/i.test(signatureHex)) return false;
  const url = new URL(request.url);
  const input = `${timestamp}\n${request.method}\n${url.pathname}\n${await sha256Hex(body)}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(input)));
  const actual = new Uint8Array(signatureHex.match(/.{2}/g)!.map((pair) => Number.parseInt(pair, 16)));
  return safeEqual(expected, actual);
}

function isSafeCursor(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

async function validateBatch(value: unknown, nowUs = Date.now() * 1_000): Promise<JetstreamBatch> {
  if (!value || typeof value !== 'object') throw new Error('Invalid batch');
  const candidate = value as { cursor?: unknown; events?: unknown; quarantined?: unknown };
  const quarantined = candidate.quarantined ?? [];
  if (
    !isSafeCursor(candidate.cursor)
    || candidate.cursor > nowUs + MAX_FUTURE_CURSOR_US
    || !Array.isArray(candidate.events)
    || !Array.isArray(quarantined)
    || candidate.events.length + quarantined.length > MAX_BATCH_EVENTS
  ) {
    throw new Error('Invalid batch');
  }
  const cursor = candidate.cursor;

  const events: JetstreamEvent[] = [];
  for (const raw of candidate.events) {
    if (!raw || typeof raw !== 'object') throw new Error('Invalid event');
    const event = raw as Partial<JetstreamEvent>;
    const commit = event.commit as Partial<JetstreamCommit> | undefined;
    const recordIsObject = commit?.record !== null && typeof commit?.record === 'object' && !Array.isArray(commit.record);
    const recordType = recordIsObject
      ? (commit.record as { $type?: unknown }).$type
      : undefined;
    if (
      typeof event.eventId !== 'string'
      || typeof event.did !== 'string'
      || !event.did.startsWith('did:')
      || !isSafeCursor(event.timeUs)
      || event.timeUs > candidate.cursor
      || event.kind !== 'commit'
      || !commit
      || commit.collection !== 'uk.skyblur.post'
      || typeof commit.rkey !== 'string'
      || commit.rkey.length === 0
      || !['create', 'update', 'delete'].includes(String(commit.operation))
      || (commit.operation !== 'delete' && !recordIsObject)
      || (recordType !== undefined && recordType !== 'uk.skyblur.post')
    ) throw new Error('Invalid event');

    const normalized = {
      did: event.did,
      timeUs: event.timeUs,
      kind: 'commit' as const,
      commit: {
        rev: typeof commit.rev === 'string' ? commit.rev : undefined,
        operation: commit.operation as JetstreamCommit['operation'],
        collection: 'uk.skyblur.post' as const,
        rkey: commit.rkey,
        cid: typeof commit.cid === 'string' ? commit.cid : undefined,
        record: commit.record,
      },
    };
    if (event.eventId !== await canonicalEventId(normalized)) throw new Error('Invalid event ID');
    events.push({ eventId: event.eventId, ...normalized });
  }
  const normalizedQuarantines: JetstreamQuarantine[] = quarantined.map((raw) => {
    if (!raw || typeof raw !== 'object') throw new Error('Invalid quarantine');
    const item = raw as Partial<JetstreamQuarantine>;
    if (
      !isSafeCursor(item.cursor)
      || item.cursor > cursor
      || typeof item.hash !== 'string'
      || !/^[0-9a-f]{64}$/.test(item.hash)
      || !['invalid_envelope', 'invalid_commit', 'invalid_record'].includes(String(item.reason))
      || item.did !== undefined && (typeof item.did !== 'string' || item.did.length > 256)
      || item.collection !== undefined && (typeof item.collection !== 'string' || item.collection.length > 256)
      || item.rkey !== undefined && (typeof item.rkey !== 'string' || item.rkey.length > 512)
    ) throw new Error('Invalid quarantine');
    return item as JetstreamQuarantine;
  });
  return { cursor, events, quarantined: normalizedQuarantines };
}

async function authenticatedBody(c: Context<{ Bindings: Env }>): Promise<Uint8Array | Response> {
  const contentLength = Number(c.req.header('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_INGEST_BODY_BYTES) {
    return c.json({ error: 'Payload too large' }, 413);
  }
  const body = new Uint8Array(await c.req.raw.arrayBuffer());
  if (body.byteLength > MAX_INGEST_BODY_BYTES) return c.json({ error: 'Payload too large' }, 413);
  if (!(await verifySignedRequest(c.req.raw, body, c.env.JETSTREAM_INGEST_SECRET))) {
    console.warn('[jetstream] signed request rejected', {
      path: new URL(c.req.url, 'http://localhost').pathname,
      hasSecret: Boolean(c.env.JETSTREAM_INGEST_SECRET),
      timestampPresent: Boolean(c.req.header('x-skyblur-timestamp')),
      signaturePresent: Boolean(c.req.header('x-skyblur-signature')),
    });
    return c.json({ error: 'Unauthorized' }, 401);
  }
  return body;
}

export async function ingest(c: Context<{ Bindings: Env }>) {
  const authenticated = await authenticatedBody(c);
  if (authenticated instanceof Response) return authenticated;
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(authenticated));
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  let batch: JetstreamBatch;
  try {
    batch = await validateBatch(parsed);
  } catch {
    return c.json({ error: 'Invalid Jetstream batch' }, 400);
  }

  const namespace = c.env.SKYBLUR_DO_JETSTREAM_INGEST;
  const stub = namespace.get(namespace.idFromName('uk.skyblur.post'));
  try {
    const response = await stub.fetch('https://jetstream-ingest/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    });
    return new Response(await response.text(), {
      status: response.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch {
    return c.json({ error: 'Failed to persist Jetstream batch' }, 503);
  }
}

export async function state(c: Context<{ Bindings: Env }>) {
  const authenticated = await authenticatedBody(c);
  if (authenticated instanceof Response) return authenticated;
  const namespace = c.env.SKYBLUR_DO_JETSTREAM_INGEST;
  const stub = namespace.get(namespace.idFromName('uk.skyblur.post'));
  try {
    const response = await stub.fetch('https://jetstream-ingest/state');
    return new Response(await response.text(), {
      status: response.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch {
    return c.json({ error: 'Failed to load Jetstream state' }, 503);
  }
}

/** Public, read-only health signal for StatusCheck. */
export async function publicCursor(c: Context<{ Bindings: Env }>) {
  const namespace = c.env.SKYBLUR_DO_JETSTREAM_INGEST;
  const stub = namespace.get(namespace.idFromName('uk.skyblur.post'));
  try {
    const response = await stub.fetch('https://jetstream-ingest/state');
    if (!response.ok) {
      return c.json({ error: 'Failed to load Jetstream cursor' }, 503);
    }
    const payload = await response.json() as { committedCursor?: unknown; lastIngestedAt?: unknown };
    return Response.json({
      cursor: typeof payload.committedCursor === 'number' ? payload.committedCursor : null,
      lastIngestedAt: typeof payload.lastIngestedAt === 'number' ? payload.lastIngestedAt : null,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return c.json({ error: 'Failed to load Jetstream cursor' }, 503);
  }
}

/** Public read-only projection source check for StatusCheck/debugging. */
export async function publicMirrorSource(c: Context<{ Bindings: Env }>) {
  const repo = c.req.query('repo');
  const rkey = c.req.query('rkey');
  if (!repo?.startsWith('did:') || !rkey) return c.json({ error: 'repo and rkey are required' }, 400);
  const namespace = c.env.SKYBLUR_DO_POST_MIRROR;
  try {
    const response = await namespace.get(namespace.idFromName(repo)).fetch(
      `https://mirror/record?repo=${encodeURIComponent(repo)}&rkey=${encodeURIComponent(rkey)}`,
    );
    if (response.status === 404) return c.json({ source: null }, 404);
    if (!response.ok) return c.json({ error: 'Failed to load mirror record' }, 503);
    const record = await response.json() as { source?: unknown; pdsGeneration?: unknown; cid?: unknown; timeUs?: unknown };
    return Response.json({
      source: record.source ?? null,
      pdsGeneration: record.pdsGeneration ?? null,
      cid: typeof record.cid === 'string' ? record.cid : null,
      timeUs: typeof record.timeUs === 'number' ? record.timeUs : null,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return c.json({ error: 'Failed to load mirror record' }, 503);
  }
}

function isInspectorAuthorized(c: Context<{ Bindings: Env }>): boolean {
  const token = c.env.MIRROR_INSPECT_TOKEN;
  return !!token && c.req.header('authorization') === `Bearer ${token}`;
}

export async function inspectRecord(c: Context<{ Bindings: Env }>) {
  if (!isInspectorAuthorized(c)) return c.json({ error: 'Unauthorized' }, 401);
  const uri = c.req.query('uri');
  const match = uri?.match(/^at:\/\/([^/]+)\/uk\.skyblur\.post\/([^/]+)$/);
  if (!match) return c.json({ error: 'Invalid uk.skyblur.post URI' }, 400);
  const [, repo, rkey] = match;
  const namespace = c.env.SKYBLUR_DO_POST_MIRROR;
  const response = await namespace.get(namespace.idFromName(repo)).fetch(
    `https://mirror/record?repo=${encodeURIComponent(repo)}&rkey=${encodeURIComponent(rkey)}`,
  );
  return new Response(await response.text(), { status: response.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

export async function inspectRecords(c: Context<{ Bindings: Env }>) {
  if (!isInspectorAuthorized(c)) return c.json({ error: 'Unauthorized' }, 401);
  const repo = c.req.query('repo');
  if (!repo?.startsWith('did:')) return c.json({ error: 'Invalid repo DID' }, 400);
  const namespace = c.env.SKYBLUR_DO_POST_MIRROR;
  const response = await namespace.get(namespace.idFromName(repo)).fetch(`https://mirror/records?repo=${encodeURIComponent(repo)}`);
  return new Response(await response.text(), { status: response.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}


export async function inspectStatus(c: Context<{ Bindings: Env }>) {
  if (!isInspectorAuthorized(c)) return c.json({ error: 'Unauthorized' }, 401);
  const repo = c.req.query('repo');
  if (!repo?.startsWith('did:')) return c.json({ error: 'Invalid repo DID' }, 400);
  const namespace = c.env.SKYBLUR_DO_POST_MIRROR;
  const response = await namespace.get(namespace.idFromName(repo)).fetch('https://mirror/status');
  return new Response(await response.text(), { status: response.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

export async function resolveQuarantinedFrame(c: Context<{ Bindings: Env }>) {
  if (!isInspectorAuthorized(c)) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json().catch(() => null) as {
    hash?: unknown; resolution?: unknown; remediatedBy?: unknown;
  } | null;
  if (
    !body
    || typeof body.hash !== 'string'
    || !/^[0-9a-f]{64}$/.test(body.hash)
    || !['backfilled', 'replayed', 'ignored'].includes(String(body.resolution))
    || typeof body.remediatedBy !== 'string'
    || body.remediatedBy.length < 1
    || body.remediatedBy.length > 256
  ) {
    return c.json({ error: 'Invalid quarantine resolution' }, 400);
  }
  const namespace = c.env.SKYBLUR_DO_JETSTREAM_INGEST;
  const response = await namespace.get(namespace.idFromName('uk.skyblur.post')).fetch(
    'https://jetstream-ingest/quarantine/resolve',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hash: body.hash, resolution: body.resolution, remediatedBy: body.remediatedBy,
      }),
    },
  );
  return new Response(await response.text(), {
    status: response.status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
