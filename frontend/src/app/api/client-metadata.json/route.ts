export const runtime = 'edge';
import { clientMetadataByEnv } from '@/types/ClientMetadataContext'

export async function GET(request: Request) {
  const origin = request.headers.get('host') || ''
  let envLocal = ''
  if (process.env.NODE_ENV === 'production') {
    if (origin.includes('preview')) {
      envLocal = 'preview'
    } else if (origin.includes('skyblur.uk')) {
      envLocal = 'production'
    }
  } else {
    envLocal = 'local'
  }

  const obj = clientMetadataByEnv[envLocal];

  if (!obj) {
    return new Response(JSON.stringify({ error: 'No metadata found for the environment.' + origin }), {
      status: 500,
      headers: {
        'content-type': 'application/json'
      }
    });
  }

  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: {
      'content-type': 'application/json'
    }
  });

}