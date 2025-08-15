import { fetchWithDpop, verifyCookie } from "@/logic/HandleXrpcProxy";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const allowedOrigins = [
  'https://skyblur.usounds.work',
  'https://skyblur.uk',
  'https://preview.skyblur.uk'
];

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  return handleXrpcRequest(request, context);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  return handleXrpcRequest(request, context);
}

async function handleXrpcRequest(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  // 呼び出し元の制限（同一オリジンのみ）
  const referer = request.headers.get('referer') || '';
  const isAllowed = allowedOrigins.some(o => referer.startsWith(o));
  if (!isAllowed) {
    return new Response('Forbidden', { status: 403 });
  }

  // params を await して取り出す
  const { path } = await context.params;
  const endpoint = `/xrpc/${path.join('.')}`;

  // クッキーをパース
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [key, ...vals] = c.trim().split('=');
      return [key, decodeURIComponent(vals.join('='))];
    })
  );
  const oauthKey = cookies['oauth_key'];
  if (!oauthKey) {
    return new Response('Missing oauth_key', { status: 400 });
  }

  // Cloudflare KV 取得
  const env = getCloudflareContext().env;
  const myKv = env.SKYBLUR_OAUTH;

  // Cookie の検証
  const kvKeyVerified = await verifyCookie(oauthKey);
  if (!kvKeyVerified) {
    return new Response('Invalid oauth_key', { status: 401 });
  }

  // セッションのトークン取得
  const tokenRaw = await myKv.get('session:' + kvKeyVerified);
  if (!tokenRaw) {
    return new Response('Token not found', { status: 401 });
  }

  try {
    // GETクエリ文字列保持
    const url = new URL(request.url);
    const queryString = url.search;

    // POST ボディの準
    const contentType = request.headers.get('content-type') || '';
    console.log('contentType:'+contentType)
    let body: string | Blob | FormData | URLSearchParams | undefined;

    if (request.method === 'POST') {
      const contentType = request.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const json = await request.json().catch(() => null);
        body = json ? JSON.stringify(json) : undefined;
      } else if (contentType.includes('multipart/form-data')) {
        body = await request.formData();
      } else if (contentType.includes('text/plain')) {
        const text = await request.text();
        body = new Blob([text], { type: 'text/plain' });
      } else {
        body = await request.blob(); // その他は Blob
      }
    }

    // DPoP 付きで Bluesky API にプロキシ
    const result = await fetchWithDpop(
      endpoint + queryString,
      {
        method: request.method as 'GET' | 'POST',
        body,
      },
      oauthKey,
      contentType
    );

    // uploadBlob など、JSON を透過して返す場合はそのまま
    // 通常の JSON レスポンスもそのまま返す
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    interface ErrorPayload {
      message?: string;
      [key: string]: unknown;
    }

    let payload: ErrorPayload;

    if (e instanceof Error) {
      try {
        payload = JSON.parse(e.message) as ErrorPayload;
      } catch {
        payload = { message: e.message };
      }
    } else {
      payload = { message: String(e) };
    }

    return new Response(JSON.stringify(payload), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
