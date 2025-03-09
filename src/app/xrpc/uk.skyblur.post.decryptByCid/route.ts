export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server";
import { decryption } from "@/logic/HandleEncrypt";

export async function POST(req: NextRequest) {
    const origin = req.headers.get('origin')
    if (process.env.NODE_ENV === 'production' &&
        origin !== 'https://preview.skyblur.pages.dev' &&
        origin !== 'https://skyblur.uk') {
        return new Response('This Skyblur is in production mode. The setQuery API only accepts requests via https://skyblur.uk', {
            status: 500
        });
    }
    
    try {
        let { pds, repo, cid, password } = await req.json();
        if (!pds || !repo || !cid || !password) {
            return NextResponse.json({ error: "pds, repo, cid, password are required" }, { status: 400 });
        }
    
        return await decryption(pds,repo,cid,password);

    } catch (error) {
        return NextResponse.json({ error: "Decryption failed. " + error }, { status: 500 });
    }
}
