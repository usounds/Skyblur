import { describe, expect, it, vi } from 'vitest';
import {
  canonicalEventId,
  ingest,
  inspectRecord,
  inspectRecords,
  requeueMirrorFailures,
  resolveQuarantinedFrame,
  state,
  verifySignedRequest,
  type JetstreamBatch,
  type JetstreamEvent,
} from '../jetstream';
import { compareProjectionOrder } from '../PostMirrorDO';

const secret = 'test-jetstream-secret';
const timestamp = new Date().toISOString();
const now = Date.parse(timestamp);

async function event(overrides: Partial<JetstreamEvent> = {}): Promise<JetstreamEvent> {
  const value = {
    did: 'did:plc:author',
    timeUs: 1_784_214_110_241_123,
    kind: 'commit' as const,
    commit: {
      rev: '3mqrhiyovtkyz',
      operation: 'create' as const,
      collection: 'uk.skyblur.post' as const,
      rkey: '3mqrhiyovtkyz',
      cid: 'bafyrecord',
      record: { $type: 'uk.skyblur.post', text: 'hello' },
    },
    ...overrides,
  };
  return { eventId: await canonicalEventId(value), ...value };
}

async function signedRequest(url: string, method: string, body = '', requestTimestamp = timestamp) {
  const bytes = new TextEncoder().encode(body);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const digestHex = [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const path = new URL(url).pathname;
  const input = `${requestTimestamp}\n${method}\n${path}\n${digestHex}`;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(input)));
  const signatureHex = [...signature].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return new Request(url, {
    method,
    body: method === 'GET' ? undefined : body,
    headers: {
      'Content-Type': 'application/json',
      'X-Skyblur-Timestamp': requestTimestamp,
      'X-Skyblur-Signature': `sha256=${signatureHex}`,
    },
  });
}

function context(request: Request, env: Record<string, unknown>) {
  return {
    env,
    req: {
      raw: request,
      header: (name: string) => request.headers.get(name) ?? undefined,
      query: vi.fn(),
    },
    json: (body: unknown, status = 200) => Response.json(body, { status }),
  } as any;
}

describe('Jetstream ingest authentication', () => {
  it('matches the Go consumer HMAC contract and rejects expired signatures', async () => {
    const request = await signedRequest('https://api.skyblur.uk/internal/jetstream/ingest', 'POST', '{}');
    expect(await verifySignedRequest(request, new TextEncoder().encode('{}'), secret, now)).toBe(true);
    expect(await verifySignedRequest(request, new TextEncoder().encode('{}'), secret, now + 6 * 60 * 1000)).toBe(false);
    expect(await verifySignedRequest(request, new TextEncoder().encode('{"changed":true}'), secret, now)).toBe(false);
  });

  it('rejects unsigned input before accessing the Durable Object', async () => {
    const namespace = { idFromName: vi.fn(), get: vi.fn() };
    const request = new Request('https://api.skyblur.uk/internal/jetstream/ingest', { method: 'POST', body: '{}' });
    const response = await ingest(context(request, {
      JETSTREAM_INGEST_SECRET: secret,
      SKYBLUR_DO_JETSTREAM_INGEST: namespace,
    }));
    expect(response.status).toBe(401);
    expect(namespace.get).not.toHaveBeenCalled();
  });

  it('validates canonical event IDs and forwards a signed batch', async () => {
    const item = await event();
    const batch: JetstreamBatch = { cursor: item.timeUs, events: [item] };
    const body = JSON.stringify(batch);
    const request = await signedRequest('https://api.skyblur.uk/internal/jetstream/ingest', 'POST', body);
    const stub = { fetch: vi.fn().mockResolvedValue(Response.json({ accepted: true, committedCursor: item.timeUs })) };
    const namespace = { idFromName: vi.fn().mockReturnValue('id'), get: vi.fn().mockReturnValue(stub) };
    const response = await ingest(context(request, {
      JETSTREAM_INGEST_SECRET: secret,
      SKYBLUR_DO_JETSTREAM_INGEST: namespace,
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ accepted: true, committedCursor: item.timeUs });
    expect(stub.fetch).toHaveBeenCalledWith('https://jetstream-ingest/ingest', expect.objectContaining({ method: 'POST' }));
  });

  it('rejects a forged event ID without touching storage', async () => {
    const item = await event({ eventId: 'jetstream:forged' });
    item.eventId = 'jetstream:forged';
    const body = JSON.stringify({ cursor: item.timeUs, events: [item] });
    const request = await signedRequest('https://api.skyblur.uk/internal/jetstream/ingest', 'POST', body);
    const namespace = { idFromName: vi.fn(), get: vi.fn() };
    const response = await ingest(context(request, {
      JETSTREAM_INGEST_SECRET: secret,
      SKYBLUR_DO_JETSTREAM_INGEST: namespace,
    }));
    expect(response.status).toBe(400);
    expect(namespace.get).not.toHaveBeenCalled();
  });

  it('rejects null and explicitly mistyped records before storage', async () => {
    for (const record of [null, { $type: 'app.bsky.feed.post', text: 'wrong' }]) {
      const item = await event();
      item.commit.record = record;
      const unsigned = {
        did: item.did, timeUs: item.timeUs, kind: item.kind,
        commit: item.commit,
      };
      item.eventId = await canonicalEventId(unsigned);
      const body = JSON.stringify({ cursor: item.timeUs, events: [item] });
      const request = await signedRequest('https://api.skyblur.uk/internal/jetstream/ingest', 'POST', body);
      const namespace = { idFromName: vi.fn(), get: vi.fn() };
      const response = await ingest(context(request, {
        JETSTREAM_INGEST_SECRET: secret,
        SKYBLUR_DO_JETSTREAM_INGEST: namespace,
      }));
      expect(response.status).toBe(400);
      expect(namespace.get).not.toHaveBeenCalled();
    }
  });

  it('rejects a future cursor before it can poison durable state', async () => {
    const body = JSON.stringify({ cursor: Date.now() * 1_000 + 6 * 60 * 1_000_000, events: [] });
    const request = await signedRequest('https://api.skyblur.uk/internal/jetstream/ingest', 'POST', body);
    const namespace = { idFromName: vi.fn(), get: vi.fn() };
    const response = await ingest(context(request, {
      JETSTREAM_INGEST_SECRET: secret,
      SKYBLUR_DO_JETSTREAM_INGEST: namespace,
    }));
    expect(response.status).toBe(400);
    expect(namespace.get).not.toHaveBeenCalled();
  });

  it('accepts only bounded quarantine metadata and never raw malformed records', async () => {
    const cursor = Date.now() * 1_000;
    const body = JSON.stringify({
      cursor,
      events: [],
      quarantined: [{ cursor, hash: 'a'.repeat(64), reason: 'invalid_record' }],
    });
    const request = await signedRequest('https://api.skyblur.uk/internal/jetstream/ingest', 'POST', body);
    const stub = { fetch: vi.fn().mockResolvedValue(Response.json({ accepted: true, committedCursor: cursor })) };
    const namespace = { idFromName: vi.fn().mockReturnValue('id'), get: vi.fn().mockReturnValue(stub) };
    const response = await ingest(context(request, {
      JETSTREAM_INGEST_SECRET: secret,
      SKYBLUR_DO_JETSTREAM_INGEST: namespace,
    }));
    expect(response.status).toBe(200);
    const forwarded = JSON.parse((stub.fetch.mock.calls[0][1] as RequestInit).body as string);
    expect(forwarded.quarantined).toEqual([{ cursor, hash: 'a'.repeat(64), reason: 'invalid_record' }]);
    expect(JSON.stringify(forwarded)).not.toContain('raw');
  });

  it('returns the durable cursor through the signed state endpoint', async () => {
    const request = await signedRequest('https://api.skyblur.uk/internal/jetstream/state', 'GET');
    const stub = { fetch: vi.fn().mockResolvedValue(Response.json({ committedCursor: 123 })) };
    const namespace = { idFromName: vi.fn().mockReturnValue('id'), get: vi.fn().mockReturnValue(stub) };
    const response = await state(context(request, {
      JETSTREAM_INGEST_SECRET: secret,
      SKYBLUR_DO_JETSTREAM_INGEST: namespace,
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ committedCursor: 123 });
  });
});

describe('mirror ordering', () => {
  const base = {
    source: 'jetstream' as const,
    time_us: 100,
    rev: 'rev-2',
    operation: 'update',
    event_id: 'event-2',
  };

  it('never lets backfill replace a live projection', () => {
    expect(compareProjectionOrder({ ...base, source: 'backfill', time_us: 200 }, base)).toBeLessThan(0);
  });

  it('keeps delete ahead of update when time and revision are equal', () => {
    expect(compareProjectionOrder({ ...base, operation: 'delete' }, base)).toBeGreaterThan(0);
    expect(compareProjectionOrder(base, { ...base, operation: 'delete' })).toBeLessThan(0);
  });

  it('orders microsecond timestamps without rounding', () => {
    expect(compareProjectionOrder({ ...base, time_us: 101 }, base)).toBeGreaterThan(0);
  });
});

describe('mirror inspection', () => {
  it('protects and forwards record inspection without Airglow-specific naming', async () => {
    const stub = { fetch: vi.fn().mockResolvedValue(Response.json({ value: { text: 'hello' } })) };
    const namespace = { idFromName: vi.fn().mockReturnValue('id'), get: vi.fn().mockReturnValue(stub) };
    const request = new Request('https://api.skyblur.uk/internal/mirror/record', {
      headers: { Authorization: 'Bearer inspect-secret' },
    });
    const c = context(request, { MIRROR_INSPECT_TOKEN: 'inspect-secret', SKYBLUR_DO_POST_MIRROR: namespace });
    c.req.query = vi.fn().mockReturnValue('at://did:plc:author/uk.skyblur.post/abc');
    const response = await inspectRecord(c);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ value: { text: 'hello' } });
  });

  it('returns the latest stored state for a DID with no-store', async () => {
    const payload = { repo: 'did:plc:author', records: [] };
    const stub = { fetch: vi.fn().mockResolvedValue(Response.json(payload)) };
    const namespace = { idFromName: vi.fn().mockReturnValue('id'), get: vi.fn().mockReturnValue(stub) };
    const request = new Request('https://api.skyblur.uk/internal/mirror/records', {
      headers: { Authorization: 'Bearer inspect-secret' },
    });
    const c = context(request, { MIRROR_INSPECT_TOKEN: 'inspect-secret', SKYBLUR_DO_POST_MIRROR: namespace });
    c.req.query = vi.fn().mockReturnValue('did:plc:author');
    const response = await inspectRecords(c);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(payload);
  });

  it('requires the inspector token for requeue and quarantine resolution', async () => {
    const stub = { fetch: vi.fn().mockResolvedValue(Response.json({ accepted: true, requeued: 1 })) };
    const namespace = { idFromName: vi.fn().mockReturnValue('id'), get: vi.fn().mockReturnValue(stub) };
    const unauthorized = context(new Request('https://api.skyblur.uk/internal/mirror/requeue', { method: 'POST' }), {
      MIRROR_INSPECT_TOKEN: 'inspect-secret', SKYBLUR_DO_JETSTREAM_INGEST: namespace,
    });
    expect((await requeueMirrorFailures(unauthorized)).status).toBe(401);
    expect(stub.fetch).not.toHaveBeenCalled();

    const authorized = context(new Request('https://api.skyblur.uk/internal/mirror/requeue', {
      method: 'POST', headers: { Authorization: 'Bearer inspect-secret' },
    }), { MIRROR_INSPECT_TOKEN: 'inspect-secret', SKYBLUR_DO_JETSTREAM_INGEST: namespace });
    expect((await requeueMirrorFailures(authorized)).status).toBe(200);

    stub.fetch.mockResolvedValueOnce(Response.json({ accepted: true, resolved: 1 }));
    const resolve = context(new Request('https://api.skyblur.uk/internal/mirror/quarantine/resolve', {
      method: 'POST',
      headers: { Authorization: 'Bearer inspect-secret', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hash: 'a'.repeat(64), resolution: 'backfilled', remediatedBy: 'test-operator',
      }),
    }), { MIRROR_INSPECT_TOKEN: 'inspect-secret', SKYBLUR_DO_JETSTREAM_INGEST: namespace });
    resolve.req.json = () => resolve.req.raw.json();
    expect((await resolveQuarantinedFrame(resolve)).status).toBe(200);
    expect(stub.fetch).toHaveBeenLastCalledWith(
      'https://jetstream-ingest/quarantine/resolve',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
