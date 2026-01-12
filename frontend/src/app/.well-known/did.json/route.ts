import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const host = req.headers.get('host') || 'skyblur.uk';

  let apiEndpoint = 'api.skyblur.uk'
  if (process.env.NODE_ENV !== 'production') {
    apiEndpoint = 'devapi.skyblur.uk'
  }

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
