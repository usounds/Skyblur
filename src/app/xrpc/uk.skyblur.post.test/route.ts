export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server";
import {verifyJWT} from "@/logic/HandleBluesky"

export async function GET(req: NextRequest) {
  const authorization = req.headers.get('Authorization') || ''
  const decodeJWT = authorization.replace('Bearer ', '').trim()

  const result = await verifyJWT(decodeJWT, 'did:web:blursky.usounds.worka')

  if(!result){
    return NextResponse.json({ result:false });

  }

  return NextResponse.json({ result: result.verified });
}

