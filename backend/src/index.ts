import { Hono } from 'hono'
import {handle as ecnryptHandle} from "./api/ecnrypt"
import {handle as decryptByCidHandle} from "./api/decryptByCid"
import {handle as getPostHandler} from "./api/getPost"
import { cors } from 'hono/cors'

const app = new Hono()

app.options('*', (c) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return c.text(''); // OPTIONSリクエストに対する空のレスポンス
});

app.use(cors()) // すべてのリクエストでCORSを許可

app.get('/.well-known/did.json', (c) => {
  const didDocument = {
    "@context": [
      "https://www.w3.org/ns/did/v1"
    ],
    "id": `did:web:api.skyblur.uk`,
    "service": [
      {
        "id": "#skyblur_api",
        "type": "SkyblurAPIService",
        "serviceEndpoint": `https://api.skyblur.uk`
      }
    ]
  };
  return c.json(didDocument)
})

app.post('/xrpc/uk.skyblur.post.encrypt', (c) => {
  return ecnryptHandle(c)
})

app.post('/xrpc/uk.skyblur.post.decryptByCid', (c) => {
  return decryptByCidHandle(c)
})

app.post('/xrpc/uk.skyblur.post.getPost', (c) => {
  return getPostHandler(c)
})

app.get('/', (c) => {
  const returnDocument = {
    "message" : "This is Skyblur API Service. AppView is available at https://skyblur.uk/"
  };
  return c.json(returnDocument)
})


export default app
