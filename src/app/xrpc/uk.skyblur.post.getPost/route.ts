export const runtime = 'edge';
import { fetchServiceEndpoint } from "@/logic/HandleBluesky";
import { decryption } from "@/logic/HandleEncrypt";
import { PostData, SKYBLUR_POST_COLLECTION } from '@/types/types';
import { AtpAgent } from '@atproto/api';
import { NextRequest, NextResponse } from "next/server";

const SALT = process.env.SALT || "salt";

export async function POST(req: NextRequest) {
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

        console.log(repo)

        // PDSを取得
        const pdsUrl = await fetchServiceEndpoint(repo) || '';

        const pdsAgent = new AtpAgent({
            service: pdsUrl || ''
        })

        const skyblurPost = await pdsAgent.com.atproto.repo.getRecord({
            repo: repo,
            collection: SKYBLUR_POST_COLLECTION,
            rkey: rkey,
        })

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
