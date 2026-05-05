import { NextResponse } from 'next/server';

function normalizeHost(host: string) {
  return host.trim().toLowerCase();
}

function isLocalHost(host: string) {
  return /^localhost(?::\d+)?$/.test(host) || /^127\.0\.0\.1(?::\d+)?$/.test(host);
}

function getRequestHost(request: Request) {
  const url = new URL(request.url);
  return normalizeHost(
    request.headers.get('x-forwarded-host') ||
      request.headers.get('host') ||
      url.host,
  );
}

function getConfiguredHost(request: Request) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (baseUrl) {
    return new URL(baseUrl).host;
  }

  const host = getRequestHost(request);
  if (isLocalHost(host)) {
    return host;
  }

  throw new Error('NEXT_PUBLIC_BASE_URL is required outside localhost');
}

function getApiEndpoint(host: string) {
  if (host === 'preview.skyblur.uk') {
    return 'previewapi.skyblur.uk';
  }

  if (host === 'dev.skyblur.uk' || host.includes('localhost') || host.startsWith('127.0.0.1')) {
    return 'devapi.skyblur.uk';
  }

  return 'api.skyblur.uk';
}

export async function GET(request: Request) {
  const host = getConfiguredHost(request);
  const apiEndpoint = getApiEndpoint(host);

  try {
    const res = await fetch(`https://${apiEndpoint}/api/did-document?host=${host}`, {
      next: { revalidate: 3600 } // 1時間キャッシュ
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch DID document: ${res.status}`);
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching DID document:', error);
    // フォールバック（既存のロジックに近いもの）
    return NextResponse.json({
      "@context": ["https://www.w3.org/ns/did/v1"],
      "id": `did:web:${host}`,
      "service": [
        {
          "id": "#skyblur_appview",
          "type": "AtprotoAppView",
          "serviceEndpoint": `https://${host}`
        },
        {
          "id": "#skyblur_api",
          "type": "SkyblurAPI",
          "serviceEndpoint": `https://${apiEndpoint}`
        }
      ]
    });
  }
}
