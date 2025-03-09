export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server";
import { decryption } from "@/logic/HandleEncrypt";

export async function POST(req: NextRequest) {
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
