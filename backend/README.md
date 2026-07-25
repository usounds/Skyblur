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

`JetstreamIngestDO` atomically stores each batch in an Inbox and advances the
microsecond Jetstream cursor. Its alarm projects pending events into the
DID-sharded `PostMirrorDO`. The consumer advances only after the Inbox and
cursor are durable, and reconnects with a five-second rewind. Replayed events
are removed by their deterministic event ID.
Readable invalid frames are represented only by cursor, SHA-256 hash, and a
fixed reason in `quarantined_frames`; the raw malformed payload is not retained.

`PostMirrorDO` keeps only the latest state for each record, the minimum ordering
metadata and delete tombstones needed to reject stale replays, and the opaque
DID-specific PDS backfill cursor. It does not retain cumulative event history.
Live Jetstream projections always take precedence over backfill data.

Set `MIRROR_SHADOW_READ=true` while comparing the local mirror with PDS reads.
Protect manual inspection with `MIRROR_INSPECT_TOKEN`:

- `GET /internal/mirror/record?uri=<AT-URI>`
- `GET /internal/mirror/status?repo=<DID>`
- `GET /internal/mirror/records?repo=<DID>`
- `POST /internal/mirror/requeue` requeues any legacy dead letters after the
  underlying problem has been fixed.
- `POST /internal/mirror/quarantine/resolve` with
  `{"hash":"<sha256>","resolution":"backfilled|replayed|ignored","remediatedBy":"<operator>"}`
  records a reviewed resolution. Entries are retained as an audit trail; an
  `ignored` entry intentionally keeps `projectionHealthy=false`.

Do not switch reads while `projectionHealthy` is false. The state response also
reports the oldest pending/dead-letter timestamp so a newer successful event
cannot hide an older projection gap. Successfully projected Inbox rows are
removed immediately; only work awaiting projection or retry remains in the Inbox.

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
