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
        DO[("Durable Object storage")]
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
    participant RestrictedDB@{ "type": "database" } as Restricted content<br/>RestrictedPostDO

    User->>App: Create or update a post
    App->>PDS: Restricted only: uk.skyblur.post.store (withProxy)
    PDS->>API: Proxy store procedure
    API->>RestrictedDB: Store original restricted content
    RestrictedDB-->>API: Stored
    API-->>PDS: Success
    PDS-->>App: Success
    App->>PDS: com.atproto.repo.applyWrites<br/>uk.skyblur.post + app.bsky.feed.post + optional gates
```

### Post read / 投稿の取得

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant App as Next.js App
    participant PDS as User PDS
    participant API as Hono API
    participant RecordsDB@{ "type": "database" } as uk.skyblur.post<br/>PostMirrorDO
    participant PublicAPI as public.api.bsky.app
    participant Constellation as Constellation
    participant RestrictedDB@{ "type": "database" } as Restricted content<br/>RestrictedPostDO

    User->>App: Open a post
    App->>PDS: uk.skyblur.post.getPost (withProxy)
    PDS->>API: Proxy read procedure
    API->>RecordsDB: Query records table
    RecordsDB-->>API: uk.skyblur.post record, 404, or read error
    API->>PDS: On 404/read error: com.atproto.repo.getRecord<br/>collection=uk.skyblur.post
    PDS-->>API: uk.skyblur.post record
    API->>PublicAPI: app.bsky.graph.getRelationships<br/>actor=requester, others=author
    PublicAPI-->>API: following / followedBy
    API->>Constellation: List only: blue.microcosm.links.getBacklinks
    Constellation-->>API: app.bsky.graph.listitem candidates
    API->>PDS: List only: com.atproto.repo.getRecord<br/>collection=app.bsky.graph.listitem
    PDS-->>API: Verified listitem record
    API->>RestrictedDB: If authorized: fetch restricted content
    RestrictedDB-->>API: Restricted content
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
    participant RecordsDB@{ "type": "database" } as uk.skyblur.post<br/>PostMirrorDO

    PDS->>Relay: uk.skyblur.post commit
    Relay->>Jetstream: Firehose stream
    Jetstream->>Consumer: uk.skyblur.post event
    Consumer->>API: HMAC-signed batch
    API->>Ingest: Process batch and cursor
    Ingest->>RecordsDB: Persist to records table
    API-->>Consumer: Committed cursor
```

## Special Thanks

fig, developer of [constellation](https://constellation.microcosm.blue/) and [Slingshot](https://slingshot.microcosm.blue/).<br />
Skyblur retrieves Like, Repost, and Intent reactions from constellation. Skyblur uses Slingshot for API proxy.
