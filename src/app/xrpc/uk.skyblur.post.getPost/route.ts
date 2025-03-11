export const runtime = 'edge';
import { fetchServiceEndpoint } from "@/logic/HandleBluesky";
import { decryption } from "@/logic/HandleEncrypt";
import { PostData, SKYBLUR_POST_COLLECTION } from '@/types/types';
import { AtpAgent } from '@atproto/api';
import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest) {
    const authorization = req.headers.get('Authorization') || ''
    const decodeJWT = authorization.replace('Bearer ', '').trim()
    const host = new URL(origin).host;

    /*
    try {
        const result = await verifyJWT(decodeJWT, `did:web:${host}`)

        if (!result || !result.verified) {
            return NextResponse.json({ error: "Invalid Token" }, { status: 400 });
        }
    } catch (e) {
        return NextResponse.json({ error: e }, { status: 400 });

    }
        */

    try {
        // リクエストボディから値を取得
        const { uri, password } = await req.json();

        // 必須パラメータのチェック
        if (!uri) {
            return NextResponse.json({ error: "uri is required" }, { status: 400 });
        }

        // `at://` を削除して `/` で分割
        const cleanedUri = uri.replace("at://", "");
        const parts = cleanedUri.split("/");

        if (parts.length < 3) {
            return NextResponse.json({ error: "Invalid uri format" }, { status: 400 });
        }

        const repo = parts[0];
        const collection = parts[1];
        const rkey = parts[2];

        if (collection !== SKYBLUR_POST_COLLECTION) {
            return NextResponse.json({ error: 'Collection should be \'uk.skyblur.post\'' }, { status: 400 });
        }

        // PDSを取得
        let pdsUrl
        try {
            pdsUrl = await fetchServiceEndpoint(repo) || '';
            if (!pdsUrl) throw new Error('Failed to get record')
        } catch (e) {
            return NextResponse.json({ error: `Cannot detect did[${repo}]'s pds.` }, { status: 404 });
        }

        const pdsAgent = new AtpAgent({
            service: pdsUrl || ''
        })

        let skyblurPost

        try {
            skyblurPost = await pdsAgent.com.atproto.repo.getRecord({
                repo: repo,
                collection: SKYBLUR_POST_COLLECTION,
                rkey: rkey,
            })
            if (!skyblurPost.success) throw new Error('Failed to get record')
        } catch (e) {
            return NextResponse.json({ error: `Cannot get record from pds[${pdsUrl}] did[${repo}] collection[${SKYBLUR_POST_COLLECTION}] rkey[${rkey}].` }, { status: 404 });
        }

        const skyblurPostObj = skyblurPost.data.value as PostData

        if (skyblurPostObj.visibility === 'password') {
            if (!password) {
                return NextResponse.json({ error: "This post visibility is 'password'. Please set 'password' parameter." }, { status: 400 });
            }
            return await decryption(pdsUrl, repo, skyblurPostObj.encryptBody?.ref.toString() || '', password);
        } else {
            return NextResponse.json({ text: skyblurPostObj.text, additional: skyblurPostObj.additional });
        }


    } catch (error) {
        return NextResponse.json({ error: "Decryption failed. " + error }, { status: 500 });
    }
}
