export const runtime = 'edge';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const host = req.headers.get('host');

  const didDocument = {
    "@context": [
      "https://www.w3.org/ns/did/v1"
    ],
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
        "serviceEndpoint": `https://api.skyblur.uk`
      }
    ]
  };

  return NextResponse.json(didDocument);
}
