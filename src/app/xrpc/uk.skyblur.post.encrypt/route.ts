export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server";
import { deriveKey } from "@/logic/HandleEncrypt";
import { verifyJWT } from "@/logic/HandleBluesky"
import * as didJWT from 'did-jwt';
import { getResolver } from "@/logic/DidPlcResolver"
import { Resolver, ResolverRegistry, DIDResolver } from 'did-resolver'
import { getResolver as getWebResolver } from 'web-did-resolver'

const myResolver = getResolver()
const web = getWebResolver()
const resolver: ResolverRegistry = {
  'plc': myResolver.DidPlcResolver as unknown as DIDResolver,
  'web': web as unknown as DIDResolver,
}
const resolverInstance = new Resolver(resolver)

export async function POST(req: NextRequest) {
  const authorization = req.headers.get('Authorization') || ''
  const decodeJWT = authorization.replace('Bearer ', '').trim()
  const origin = req.headers.get('host') || ''

  try {

    const result = await didJWT.verifyJWT(decodeJWT, {
      resolver: resolverInstance,
      audience: `did:web:${origin}`
    })

    if (!result || !result.verified) {
      const aaa = result?.verified
      return NextResponse.json({ error: `verified:${aaa} Host:${origin} JWT:${decodeJWT}` }, { status: 400 });
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
