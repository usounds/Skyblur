## Skyblur API service
We provide an API for Skyblur's password protection.<br />
The public API is intended to be called via the ATProto Proxy.
| id | serviceEndpoint |
| --------------- | ---------------------- |
| #skyblur_api | did:web:skyblur.uk |
If you are using the official ATProto SDK, you can call it as shown below.
```
const init: RequestInit = {
    method: 'POST',
    body: JSON.stringify({
        uri: 'at://did:plc:......./uk.skyblur.post/c12345678',
        password: 'p@ssw0rd'
    })
}
const response = await agent.withProxy('skyblur_api', `did:web:skyblur.uk`).fetchHandler(
    '/xrpc/uk.skyblur.post.getPost',
    init
)
```

## Getting Started

First, run the development server:
```
npm install
npx wrangler dev
```

Deploy to Cloudflare Worker:
```
npx wrangler deploy
```
