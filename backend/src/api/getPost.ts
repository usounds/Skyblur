import { Context } from 'hono'
import { verifyJWT, fetchServiceEndpoint } from '../logic/JWTTokenHandler'
import { getDecrypt } from '../logic/CryptHandler'
import { UkSkyblurPost } from '../lexicon/UkSkyblurPost'

export const handle = async (c: Context) => {
    const authorization = c.req.header('Authorization') || ''
    if (!authorization) {
        return c.json({ message: 'Authorization Header required. This api shoud be call via atproto-proxy.' }, 500);
    }

    const origin = c.env.APPVIEW_HOST
    const audience = `did:web:${origin}`

    try {
        const veriry = await verifyJWT(authorization, audience)

        if (!veriry.verified) {
            return c.json({ message: 'Cannot verify JWT Token.' }, 500);

        }
    } catch (e) {
        return c.json({ message: 'Cannot verify JWT Token. ' + e }, 500);

    }

    const { uri, password } = await c.req.json();

    console.log(uri)

    // 必須パラメータのチェック
    if (!uri) {
        return c.json({ message: 'uri is required.' }, 500);
    }

    // `at://` を削除して `/` で分割
    const cleanedUri = uri.replace("at://", "");
    const parts = cleanedUri.split("/");

    if (parts.length < 3) {
        return c.json({ message: 'Invalid uri format"' }, 500);
    }

    const repo = parts[0];
    const collection = parts[1];
    const rkey = parts[2];

    if (collection !== 'uk.skyblur.post') {
        return c.json({ message: 'Collection should be \'uk.skyblur.post\'.' }, 500);

    }

    let pdsUrl: string

    try {
        const endpoint = await fetchServiceEndpoint(repo);
        pdsUrl = Array.isArray(endpoint) ? endpoint[0] : endpoint;
        if (!pdsUrl) throw new Error('Failed to get record')
    } catch (e) {
        return c.json({ message: `Cannot detect did[${repo}]'s pds.` }, 500);
    }

    const recortUrl = `${pdsUrl}/xrpc/com.atproto.repo.getRecord?repo=${repo}&collection=uk.skyblur.post&rkey=${rkey}`

    let recordObj

    try {
        const result = await fetch(recortUrl)
        if (!result.ok) throw new Error('Failed to get record')
        const jsonResult = await result.json() as { value: unknown };
        recordObj = jsonResult.value as UkSkyblurPost.Record;
    } catch (e) {
        return c.json({ message: `Cannot getRecord[${recortUrl}]` }, 500);

    }

    if (recordObj.visibility !== 'password') {
        console.log('public')
        console.log(recordObj)
        return c.json({ text: recordObj.text, additional: recordObj.additional });

    }
    console.log('password')

    const refLink = recordObj.encryptBody?.ref.toString();
    if (!refLink) {
        return c.json({ message: 'Reference link is missing in the record.' }, 500);
    }
    return await getDecrypt(c, pdsUrl, repo, refLink, password)

}

