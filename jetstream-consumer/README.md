# Skyblur Jetstream consumer

Small, stateless Go worker that reads `uk.skyblur.post` commits from Bluesky's
public Jetstream instances and forwards batches to the Skyblur API. A batch is
acknowledged only after the backend has synchronously applied every event and
durably committed its cursor.

The worker never stores its cursor on local disk. On startup and before every
reconnection it reads the committed cursor from Skyblur. Reconnection rewinds
that cursor by five seconds, so replayed batches are expected and the backend
deduplicates their deterministic `eventId` values.

## Required environment variables

- `SKYBLUR_STATE_URL`: authenticated endpoint returning
  `{"committedCursor": 123}`.
- `SKYBLUR_INGEST_URL`: authenticated endpoint accepting
  `{"cursor": 123, "events": [...]}` and returning the committed cursor.
- `SKYBLUR_INGEST_SECRET`: HMAC-SHA256 secret shared with the Skyblur API.

Optional limits:

- `JETSTREAM_ENDPOINTS`: comma-separated WebSocket URLs. Defaults to the two
  US-East instances followed by the two US-West instances.
- `JETSTREAM_MAX_MESSAGE_BYTES`: defaults to 1 MiB.
- `JETSTREAM_QUEUE_CAPACITY`: defaults to 8 messages.
- `JETSTREAM_MAX_BATCH_BYTES`: defaults to 1 MiB.

The connection is rotated when no Jetstream frame arrives for 90 seconds, even
if the underlying TCP/WebSocket connection still responds to pings.

Wanted commit events and quarantined frames are durably flushed within one
second. Cursor-only Account and Identity traffic is checkpointed once per
minute to avoid unnecessary API and Durable Object requests. A full batch,
disconnect, or graceful shutdown flushes immediately.

A structurally readable but invalid wanted-collection frame is not allowed to
cause an endless replay loop: its cursor, SHA-256 hash, fixed reason, and any
readable DID/collection/rkey repair identifiers are
durably quarantined with the batch before the cursor advances. Raw malformed
records are never copied into quarantine or logs. Frames whose JSON/cursor
cannot be read remain fail-closed because they cannot be skipped safely.

Requests are signed with `X-Skyblur-Timestamp` and
`X-Skyblur-Signature: sha256=<hex>`. The signature input is:

```text
timestamp + "\n" + method + "\n" + escapedPath + "\n" + sha256Hex(body)
```

Run checks with:

```sh
go test ./...
go test -race ./...
go vet ./...
```

The included multi-stage `Dockerfile` produces a static, non-root image with a
192 MiB Go runtime memory limit.

## Fly.io preview deployment

`fly.toml` runs one continuously restarting worker in `iad` with
`shared-cpu-1x` and 256 MiB RAM. It intentionally has no `http_service`; this
process only makes outbound connections to Jetstream and the Skyblur API.

Create the app without deploying:

```sh
fly apps create skyblur-jetstream
```

Set the HMAC secret before the first deploy. If it is missing, the process exits
and the `always` restart policy will repeatedly restart it.

```sh
fly secrets set SKYBLUR_INGEST_SECRET='<same value as backend JETSTREAM_INGEST_SECRET>'
```

Deploy exactly one Machine:

```sh
fly deploy --ha=false
fly scale count 1
```

Verify the Machine and consumer:

```sh
fly machine list
fly logs
```

The checked-in configuration targets the preview API. Production must use a
separate Fly app/configuration with the production state and ingest URLs.
