## Skyblur API service
We provide an API for Skyblur's password protection.<br />
The public API is intended to be called via the ATProto Proxy.
| id | serviceEndpoint |
| --------------- | ---------------------- |
| #skyblur_api | did:web:skyblur.uk |

If you are using the official ATProto SDK, you can call it as shown below.
```
const response = await agent.withProxy('skyblur_api', `did:web:skyblur.uk`).fetchHandler(
    '/xrpc/uk.skyblur.post.getPost',
    {
        method: 'POST',
        body: JSON.stringify({
            uri: 'at://did:plc:......./uk.skyblur.post/c12345678',
            password: 'p@ssw0rd'
        }  
    }
)
```

## Technology
Hono on Cloudflare Worker

## Jetstream record mirror

The Go worker in `../jetstream-consumer` consumes only `uk.skyblur.post` commits
from Bluesky's public Jetstream instances. It sends HMAC-authenticated batches
to `POST /internal/jetstream/ingest` and reads its durable resume cursor from
`GET /internal/jetstream/state`.

Configure the same `JETSTREAM_INGEST_SECRET` in this Worker and
`SKYBLUR_INGEST_SECRET` in the consumer. Requests use
`X-Skyblur-Timestamp` and `X-Skyblur-Signature: sha256=<hex>`. Signatures older
than five minutes, malformed batches, forged canonical event IDs, and events
outside `uk.skyblur.post` are rejected before Durable Object access.
Future cursors beyond five minutes are rejected independently by the consumer,
public handler, and ingest Durable Object.

`JetstreamIngestDO` applies every event in a batch synchronously to the
DID-sharded `PostMirrorDO`, then advances the microsecond Jetstream cursor only
after every projection succeeds. A failed or unaccepted projection returns 503,
so the consumer retries the whole batch. Events that were already applied are
safe to replay because `PostMirrorDO` rejects duplicates and stale events by
their deterministic event ID and ordering metadata. This is an at-least-once
flow; Durable Objects are not treated as a cross-object transaction.
Readable invalid frames are represented only by cursor, SHA-256 hash, and a
fixed reason in `quarantined_frames`; the raw malformed payload is not retained.
Quarantine metadata and the cursor are committed together, after successful
event projection.

`PostMirrorDO` keeps only the latest state for each record, the minimum ordering
metadata and delete tombstones needed to reject stale replays, and the opaque
DID-specific PDS backfill cursor. It does not retain cumulative event history.
Live Jetstream projections always take precedence over backfill data.

`getPost` reads `PostMirrorDO` first. On a true mirror miss it reads the record
from its PDS. PDS read-through caching is temporarily disabled in every checked-in
environment with `PDS_READ_THROUGH_CACHE=false`; while disabled, existing active
`source=pds` mirror rows are bypassed as well as new PDS snapshot writes, while
Jetstream-projected rows remain readable. Set the flag to `true` only after the
Jetstream consumer is healthy and its cursor is advancing. When enabled, existing
PDS mirror rows are readable and a PDS fallback snapshot is stored in the DID-scoped
mirror before returning it. A delete tombstone is distinct from a miss and never
falls back to PDS regardless of source. Mirror read or cache-write failures remain
fail-open to the PDS response; if a concurrent Jetstream projection wins while the
PDS request is in flight, `getPost` re-reads the mirror instead of returning the
stale snapshot. PDS snapshots do not advance the Jetstream watermark used for
ingestion monitoring.

Set `MIRROR_SHADOW_READ=true` while comparing the local mirror with PDS reads.
Protect manual inspection with `MIRROR_INSPECT_TOKEN`:

- `GET /internal/mirror/record?uri=<AT-URI>`
- `GET /internal/mirror/status?repo=<DID>`
- `GET /internal/mirror/records?repo=<DID>`
- `POST /internal/mirror/quarantine/resolve` with
  `{"hash":"<sha256>","resolution":"backfilled|replayed|ignored","remediatedBy":"<operator>"}`
  records a reviewed resolution. Entries are retained as an audit trail; an
  `ignored` entry intentionally keeps `projectionHealthy=false`.

Do not switch reads while `projectionHealthy` is false. In synchronous mode a
successful committed cursor means every event through that batch was accepted
by its mirror shard; unresolved or intentionally ignored quarantines keep the
health flag false.

Before deploying this version over an already-running Inbox/Alarm version,
verify that the old `/internal/jetstream/state` reports `queue.pending=0` and
`queue.deadLetters=0`. This version intentionally does not read or drain legacy
Inbox rows. No migration check is needed if the Inbox version was never deployed.

Airglow is not part of this ingestion architecture. Existing current records
stored in `PostMirrorDO` remain available. Legacy cumulative event history is
deleted when each DID-scoped object starts on this version.

## Getting Started

First, run the development server:
```
npm install
npm run dev
```

Deploy to Cloudflare Worker:
```
npm run deploy
```
