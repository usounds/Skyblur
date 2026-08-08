Blueskyに伏字の投稿ができる[Skyblur](https://skyblur.uk/)のソースコードです。<br />
This is the source code for [Skyblur](https://skyblur.uk/), a tool that allows content warning and spoiler protected posts on Bluesky.

## System Architecture / システム構成

全体構成と、投稿の保存・取得、Jetstream からの同期を分けて示します。

### Overview / 全体像

```mermaid
flowchart LR
    Browser["Web Browser"]

    subgraph Skyblur["Skyblur"]
        direction TB
        Frontend["Frontend / Next.js"]
        Backend["Backend / Cloudflare Workers / Hono"]
        Consumer["Jetstream Consumer / Fly.io / Go"]
        Storage[("Durable Object storage")]

        Frontend -->|"anonymous XRPC"| Backend
        Consumer <-->|"HMAC batch / committed cursor"| Backend
        Backend <--> Storage
    end

    subgraph ATProtocol["AT Protocol / Bluesky"]
        direction TB
        PDS["User PDS"]
        Relay["Relay"]
        Jetstream["Public Jetstream"]
        PublicAPI["Bluesky AppView / public.api.bsky.app"]

        PDS -->|"repo commits"| Relay
        Relay -->|"firehose"| Jetstream
        Relay -->|"firehose / indexing"| PublicAPI
    end

    Lexicons["uk.skyblur.* Lexicon schemas"]

    Browser --> Frontend
    Frontend <-->|"OAuth / XRPC"| PDS
    PDS -->|"withProxy"| Backend
    Backend -->|"relationship check"| PublicAPI
    Jetstream --> Consumer
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
    participant RestrictedDB@{ "type": "database" } as Restricted content

    User->>App: Create or update a post
    App->>PDS: Restricted only: uk.skyblur.post.store (withProxy)
    PDS->>API: Proxy store procedure
    API->>RestrictedDB: Store original restricted content
    RestrictedDB-->>API: Stored
    API-->>PDS: Success
    PDS-->>App: Success
    App->>PDS: com.atproto.repo.applyWrites (uk.skyblur.post + app.bsky.feed.post + optional gates)
```

### Post read / 投稿の取得

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant App as Next.js App
    participant RequesterPDS as Requester PDS
    participant API as Hono API
    participant RecordsDB@{ "type": "database" } as uk.skyblur.post
    participant AuthorPDS as Author PDS
    participant PublicAPI as public.api.bsky.app
    participant Constellation as Constellation
    participant RestrictedDB@{ "type": "database" } as Restricted content

    User->>App: Open a post
    App->>RequesterPDS: AUTHENTICATED: uk.skyblur.post.getPost (withProxy)
    RequesterPDS->>API: Proxy read procedure
    App->>API: ANONYMOUS: getPost via Next.js XRPC route
    API->>RecordsDB: Read uk.skyblur.post
    RecordsDB-->>API: uk.skyblur.post record, 404, or read error
    API->>AuthorPDS: On 404/read error: com.atproto.repo.getRecord (uk.skyblur.post)
    AuthorPDS-->>API: uk.skyblur.post record
    API->>PublicAPI: ONLY followers/following/mutual + logged-in non-author: getRelationships
    PublicAPI-->>API: following / followedBy
    API->>Constellation: ONLY list + logged-in non-author + valid listUri: getManyToMany
    Constellation-->>API: Matching list membership
    API->>RestrictedDB: If restricted access is authorized: fetch content
    RestrictedDB-->>API: Restricted content
    API-->>RequesterPDS: AUTHENTICATED response
    RequesterPDS-->>App: Response
    API-->>App: ANONYMOUS response
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
    participant Ingest as Ingestion coordinator
    participant RecordsDB@{ "type": "database" } as uk.skyblur.post

    PDS->>Relay: uk.skyblur.post commit
    Relay->>Jetstream: Firehose stream
    Jetstream->>Consumer: uk.skyblur.post event
    Consumer->>API: HMAC-signed batch
    API->>Ingest: Process batch and cursor
    Ingest->>RecordsDB: Store uk.skyblur.post
    API-->>Consumer: Committed cursor
```

## Special Thanks

fig, developer of [constellation](https://constellation.microcosm.blue/) and [Slingshot](https://slingshot.microcosm.blue/).<br />
Skyblur retrieves Like, Repost, and Intent reactions from constellation. Skyblur uses Slingshot for API proxy.
