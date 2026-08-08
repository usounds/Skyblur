Blueskyに伏字の投稿ができる[Skyblur](https://skyblur.uk/)のソースコードです。<br />
This is the source code for [Skyblur](https://skyblur.uk/), a tool that allows content warning and spoiler protected posts on Bluesky.

## System Architecture / システム構成

全体構成と、投稿の保存・取得、Jetstream からの同期を分けて示します。

### Overview / 全体像

```mermaid
flowchart LR
    Browser["Web Browser"]

    subgraph Skyblur["Skyblur"]
        direction LR
        Frontend["Frontend<br/>Next.js"]
        Backend["Backend<br/>Cloudflare Workers / Hono"]
        Consumer["Jetstream Consumer<br/>Fly.io / Go"]
        DO[("Durable Objects")]
    end

    subgraph ATProtocol["AT Protocol / Bluesky"]
        direction LR
        PDS["User PDS"]
        Jetstream["Public Jetstream"]
        PublicAPI["Bluesky Public API"]
    end

    Lexicons["uk.skyblur.*<br/>Lexicon schemas"]

    Browser --> Frontend
    Frontend <-->|"OAuth / XRPC"| PDS
    PDS -->|"withProxy"| Backend
    Backend <--> DO
    Backend -->|"relationship check"| PublicAPI
    Jetstream --> Consumer
    Consumer -->|"HMAC batch ingest"| Backend
    Lexicons -.-> Frontend
    Lexicons -.-> Backend
```

### Post write / 投稿の保存

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant App as Next.js App
    participant PDS as User PDS
    participant API as Hono API
    participant Content as RestrictedPostDO

    User->>App: Create a post
    App->>PDS: Write uk.skyblur.post record
    App->>PDS: Write restricted content (withProxy)
    PDS->>API: Proxy store request
    API->>Content: Store content
```

### Post read / 投稿の取得

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant App as Next.js App
    participant PDS as User PDS
    participant API as Hono API
    participant Mirror as PostMirrorDO
    participant Access as Access checks
    participant Content as RestrictedPostDO

    User->>App: Open a post
    App->>PDS: Read request (withProxy)
    PDS->>API: Proxy read request
    API->>Mirror: Read mirrored record
    opt Mirror cache miss
        API->>PDS: Fetch source record
        opt Read-through cache enabled
            API->>Mirror: Cache source snapshot
        end
    end
    alt Restricted visibility
        API->>Access: Verify relationship or list
        Access-->>API: Access result
        opt Authorized
            API->>Content: Fetch restricted content
            Content-->>API: Post content
        end
    else Public visibility
        Note over API: Use content from the record
    end
    API-->>PDS: Response
    PDS-->>App: Response
```

### Jetstream ingestion / Jetstream 同期

```mermaid
sequenceDiagram
    autonumber
    participant PDS as User PDS
    participant Relay as Relay / Firehose
    participant Jetstream as Public Jetstream
    participant Consumer as Go Consumer
    participant API as Internal Ingest API
    participant Ingest as JetstreamIngestDO
    participant Mirror as PostMirrorDO

    PDS->>Relay: Commit event
    Relay->>Jetstream: Firehose stream
    Jetstream->>Consumer: uk.skyblur.post event
    Consumer->>API: HMAC-signed batch
    API->>Ingest: Process batch and cursor
    Ingest->>Mirror: Project records synchronously
    API-->>Consumer: Committed cursor
```

## Special Thanks

fig, developer of [constellation](https://constellation.microcosm.blue/) and [Slingshot](https://slingshot.microcosm.blue/).<br />
Skyblur retrieves Like, Repost, and Intent reactions from constellation. Skyblur uses Slingshot for API proxy.
