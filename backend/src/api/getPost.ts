import { UkSkyblurPost, UkSkyblurPostGetPost } from '@/lexicon/UkSkyblur'
import { getDecrypt } from '@/logic/CryptHandler'
import { fetchServiceEndpoint, verifyJWT } from '@/logic/JWTTokenHandler'
import { Context } from 'hono'

import { getAuthenticatedDid } from '@/logic/AuthUtils'

export const handle = async (c: Context) => {
    const authorization = c.req.header('Authorization') || ''
    // Auth logic via Utils
    const requesterDid = await getAuthenticatedDid(c) || '';

    let { uri, password } = await c.req.json() as UkSkyblurPostGetPost.Input
    uri = decodeURIComponent(uri) as any;
    console.log(`[getPost] Requested URI: ${uri}, Requester: ${requesterDid}`);

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

    const repo = decodeURIComponent(parts[0]);
    const collection = parts[1];
    const rkey = parts[2];

    if (collection !== 'uk.skyblur.post') {
        return c.json({ message: 'Collection should be \'uk.skyblur.post\'.' }, 500);

    }

    let pdsUrl: string

    try {
        const endpoint = await fetchServiceEndpoint(repo);
        pdsUrl = Array.isArray(endpoint) ? endpoint[0] : endpoint;
        if (!pdsUrl) throw new Error('Failed to get PDS URL')
    } catch (e) {
        console.error(`[getPost] PDS Fetch Error: ${e}`);
        return c.json({ message: `Cannot detect did[${repo}]'s pds.` }, 500);
    }

    const recortUrl = `${pdsUrl}/xrpc/com.atproto.repo.getRecord?repo=${repo}&collection=uk.skyblur.post&rkey=${rkey}`

    let recordObj

    try {
        const result = await fetch(recortUrl)
        if (!result.ok) {
            const errText = await result.text();
            console.error(`[getPost] getRecord failed: ${result.status} ${errText}`);
            throw new Error('Failed to get record')
        }
        const jsonResult = await result.json() as { value: unknown };
        recordObj = jsonResult.value as UkSkyblurPost.Record;
    } catch (e) {
        console.error(`[getPost] Record Fetch Error: ${e}`);
        return c.json({ message: `Cannot getRecord[${recortUrl}]` }, 500);
    }

    // Visibility checks
    const visibility = recordObj.visibility as string;
    console.log(`[getPost] Visibility: ${visibility}, Requester: ${requesterDid}, Repo: ${repo}`);

    if (['followers', 'following', 'mutual'].includes(visibility)) {
        if (!requesterDid) {
            console.log('[getPost] No requesterDid -> Returning masked.');
            return c.json({
                text: recordObj.text,
                additional: '',
                debug: {
                    reason: 'No requesterDid',
                    visibility
                }
            });
        }

        let isAuthorized = false;

        if (requesterDid === repo) {
            console.log('[getPost] Author access -> Authorized.');
            isAuthorized = true;
        } else {
            console.log('[getPost] Checking relationship...');
            // Check relationship
            try {

                // Using the user's token to fetch relationships
                // We need to construct a request to the AppView (bsky.social or explicit host)
                const appViewHost = c.env.APPVIEW_HOST || 'api.bsky.app'; // Default to public AppView if not set
                const serviceUrl = `https://${appViewHost}`;

                // We need to use `agent` or raw fetch.
                // Using raw fetch for `app.bsky.graph.getRelationships`
                const relParam = `actor=${requesterDid}&others=${repo}`;
                const relUrl = `${serviceUrl}/xrpc/app.bsky.graph.getRelationships?${relParam}`;

                const relRes = await fetch(relUrl, {
                    headers: {
                        'Authorization': authorization
                    }
                });

                if (relRes.ok) {
                    const relData = await relRes.json() as any;
                    // relationships structure: { actor: did, relationships: [ { did: target, following: uri, followedBy: uri } ] }
                    const rel = relData.relationships?.[0];
                    if (rel) {
                        const isFollowing = !!rel.following; // Requester follows Author
                        const isFollowedBy = !!rel.followedBy; // Author follows Requester

                        if (visibility === 'followers') {
                            isAuthorized = isFollowing || requesterDid === repo;
                        } else if (visibility === 'following') {
                            isAuthorized = isFollowedBy || requesterDid === repo;
                        } else if (visibility === 'mutual') {
                            isAuthorized = (isFollowing && isFollowedBy) || requesterDid === repo;
                        }
                    }
                } else {
                    console.error("Failed to fetch relationships", await relRes.text());
                    // Fallback: access denied
                }

            } catch (e) {
                console.error("Error checking relationships", e);
            }
        }

        if (!isAuthorized) {
            console.log(`[getPost] NOT Authorized. Visibility: ${visibility}, Requester: ${requesterDid}, Repo: ${repo}`);
            return c.json({
                text: recordObj.text,
                additional: '',
                debug: {
                    reason: 'Not authorized',
                    requesterDid,
                    repo,
                    visibility
                }
            });
        }

        // Authorized: Fetch content from DO
        try {
            const doNamespace = (c.env as any).SKYBLUR_DO_RESTRICTED as DurableObjectNamespace;
            // Sharding by Author DID (same as store logic)
            const doId = doNamespace.idFromName(repo);
            const stub = doNamespace.get(doId);

            const doRes = await stub.fetch(new Request('http://do/get?key=' + encodeURIComponent(uri)));
            if (doRes.ok) {
                const data = await doRes.json() as { text: string, additional: string };
                return c.json({ text: data.text, additional: data.additional });
            } else {
                return c.json({
                    text: recordObj.text,
                    additional: '',
                    debug: {
                        reason: 'Content missing in DO',
                        doId: doId.toString(),
                        key: uri
                    }
                });
            }
        } catch (e) {
            console.error("DO Fetch Error", e);
            return c.json({ message: "Internal server error fetching content." }, 500);
        }
    }

    // Previous password logic
    if (recordObj.visibility === 'password') {
        if (!password) {
            return c.json({ message: "A password is required because the visibility of this post is set to 'password'." }, 500);
        }

        // Define a minimal interface for the Blob structure we expect
        interface BlobWithRef {
            ref: { toString: () => string };
        }

        const blob = recordObj.encryptBody as unknown as BlobWithRef;
        const refLink = blob?.ref?.toString();
        if (!refLink) {
            return c.json({ message: 'Reference link is missing in the record.' }, 500);
        }
        return await getDecrypt(c, pdsUrl, repo, refLink, password)
    }

    // Fallback for public or other types?
    return c.json({ text: recordObj.text, additional: recordObj.additional });

}

