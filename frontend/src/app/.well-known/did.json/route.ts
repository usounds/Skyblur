import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const host = req.headers.get('host');

  let appViewHost = 'skyblur.uk'
  let apiEndpoint = 'api.skyblur.uk'

  if (process.env.NODE_ENV !== 'production') {
    appViewHost = 'skyblur.usounds.work'
    apiEndpoint = 'skyblurapi.usounds.work'
  }

  const didDocument = {
    "@context": [
      "https://www.w3.org/ns/did/v1"
    ],
    "id": `did:web:${host}`,
    "service": [
      {
        "id": "#skyblur_appview",
        "type": "AtprotoAppView",
        "serviceEndpoint": `https://${appViewHost}`
      },

      {
        "id": "#skyblur_api",
        "type": "SkyblurAPI",
        "serviceEndpoint": `https://${apiEndpoint}`
      }
    ]
  };

  return NextResponse.json(didDocument);
}
