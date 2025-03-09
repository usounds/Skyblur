export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server";
import { deriveKey } from "@/logic/HandleEncrypt";
import { verifyJWT } from "@/logic/HandleBluesky"

export async function POST(req: NextRequest) {
  const authorization = req.headers.get('Authorization') || ''
  const decodeJWT = authorization.replace('Bearer ', '').trim()
  const origin = req.headers.get('host') || ''

  try {
    const result = await verifyJWT(decodeJWT, `did:web:${origin}`)

    if (!result || !result.verified) {
      return NextResponse.json({ error: `Invalid Host:${origin} JWT:${decodeJWT}` }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: e }, { status: 400 });

  }

  try {
    const { body, password } = await req.json();
    if (!body || !password) {
      return NextResponse.json({ error: "body and password are required" }, { status: 400 });
    }

    const key = await deriveKey(password);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encryptedData = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(body)
    );

    const encryptedText = `${btoa(String.fromCharCode(...iv))}:${btoa(String.fromCharCode(...new Uint8Array(encryptedData)))}`;

    return NextResponse.json({ encryptedText });
  } catch (error) {
    return NextResponse.json({ error: "Encryption failed. " + error }, { status: 500 });
  }
}
