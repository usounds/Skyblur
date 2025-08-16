import { handle as decryptByCidHandle } from "@/api/decryptByCid"
import { handle as getDidDoc } from "@/api/DidDocCache"
import { handle as ecnryptHandle } from "@/api/ecnrypt"
import { handle as getPostHandler } from "@/api/getPost"
import { handle as getJwks } from "@/api/jwks.json"
import { handle as getClientMetadata } from "@/api/client-metadata.json"
import { handle as login } from "@/api/login"
import { handle as callback } from "@/api/callback"
import { handle as xrpcProxy } from "@/api/xrpcProxy"
import { handle as getCurrectUser } from "@/api/getCurrectUser"
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { setSignedCookie } from 'hono/cookie'

const app = new Hono<{ Bindings: MyEnv }>()

interface MyEnv {
  APPVIEW_HOST: string;
  API_HOST: string;
  AUTH_SECRET: string;
  JWT_SECRET: string;
}

app.options('*', (c) => {
  c.header('Access-Control-Allow-Origin',  `https://${c.env.APPVIEW_HOST}`);
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  c.header('Access-Control-Allow-Credentials', 'true'); // ← 忘れずに
  return c.text(''); // OPTIONSリクエストに対する空のレスポンス
});

const allowedOrigins = [
  'https://skyblur.usounds.work',
  'https://skyblur.uk',
  'https://preview.skyblur.uk'
];

app.use(cors()) // すべてのリクエストでCORSを許可

app.post('/xrpc/uk.skyblur.post.encrypt', (c) => {
  return ecnryptHandle(c)
})

app.post('/xrpc/uk.skyblur.post.decryptByCid', (c) => {
  return decryptByCidHandle(c)
})

app.post('/xrpc/uk.skyblur.post.getPost', (c) => {
  return getPostHandler(c)
})

app.get('/client-metadata.json', (c) => {
  return getClientMetadata(c)
})

app.get('/jwks.json', (c) => {
  return getJwks(c)
})

app.get('/oauth/login', (c) => {
  c.header('Access-Control-Allow-Origin', `https://${c.env.APPVIEW_HOST}`);
  c.header('Access-Control-Allow-Credentials', 'true');
  return login(c)
})

app.get('/oauth/callback', (c) => {
  c.header('Access-Control-Allow-Origin', `https://${c.env.APPVIEW_HOST}`);
  c.header('Access-Control-Allow-Credentials', 'true');
  return callback(c)
})

app.get('/xrpc/uk.skyblur.admin.getDidDocument', (c) => {
  const origin = c.req.header('origin') || '';
  if (!allowedOrigins.includes(origin)) {
    //return c.json({ error: 'This method shoud be call from Skyblur AppView' }, 403);
  }

  return getDidDoc(c)
})


app.get('/oauth/getUserProfile', (c) => {
  c.header('Access-Control-Allow-Origin', `https://${c.env.APPVIEW_HOST}`);
  c.header('Access-Control-Allow-Credentials', 'true');

  return getCurrectUser(c)
})

app.all('/xrpc/*', async (c) => {  // ← async を追加
  console.log(c.env.APPVIEW_HOST)
  c.header('Access-Control-Allow-Origin', `https://${c.env.APPVIEW_HOST}`);
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  c.header('Access-Control-Allow-Credentials', 'true');

  return xrpcProxy(c)
})

app.get('/', (c) => {
  const returnDocument = {
    "message": "This is Skyblur API Service. AppView is available at https://skyblur.uk/"
  };
  return c.json(returnDocument)
})

export default app
