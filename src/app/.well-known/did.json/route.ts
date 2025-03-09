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
        "id": "#skyblur",
        "type": "SkyblurAPIService",
        "serviceEndpoint": `https://${host}`
      }
    ]
  };

  return NextResponse.json(didDocument);
}
