import { UkSkyblurPost, UkSkyblurPostGetPost } from '@/lexicon/UkSkyblur'
import { getDecrypt } from '@/logic/CryptHandler'
import { fetchServiceEndpoint } from '@/logic/JWTTokenHandler'
import { Context } from 'hono'
import { Client, simpleFetchHandler } from '@atcute/client'
import type { AppBskyGraphGetRelationships } from '@atcute/bluesky'
import { type ActorIdentifier } from '@atcute/lexicons'
import { checkListMembership, isValidListUri } from './listVisibility'

import { getAuthenticatedDid } from '@/logic/AuthUtils'
import type { Env } from '@/index'
import { PDS_CACHE_GENERATION, pdsCacheEventId } from './pdsCache'

function normalizeServiceEndpoint(endpoint: unknown): string | null {
    if (typeof endpoint === 'string') {
        return endpoint;
    }

    if (Array.isArray(endpoint) && typeof endpoint[0] === 'string') {
        return endpoint[0];
    }

    return null;
}

type RecordResult = {
    value: unknown;
    cid?: string;
    rev?: string;
    timeUs?: number;
    source?: 'jetstream' | 'pds' | 'backfill';
    pdsGeneration?: string;
    mirrorTiming?: string;
};

class MirrorDeletedError extends Error {}

async function getRecordFromEndpoint(endpoint: string, repo: string, rkey: string): Promise<RecordResult> {
    const url = new URL(`${endpoint.replace(/\/+$/, '')}/xrpc/com.atproto.repo.getRecord`);
    url.searchParams.append('repo', repo);
    url.searchParams.append('collection', 'uk.skyblur.post');
    url.searchParams.append('rkey', rkey);

    const recordUrl = url.toString();
    const result = await fetch(recordUrl, {
        headers: {
            'Accept': 'application/json',
            'User-Agent': 'SkyblurAPI/1.0',
        },
    });

    if (!result.ok) {
        const errText = await result.text();
        console.error(`[getPost] getRecord failed: ${result.status} ${errText} URL: ${recordUrl}`);
        throw new Error(`Failed to get record from ${recordUrl}`);
    }

    const record = await result.json() as { value: unknown; cid?: unknown };
    return {
        value: record.value,
        cid: typeof record.cid === 'string' ? record.cid : undefined,
    };
}

async function getSkyblurRecord(repo: string, rkey: string) {
    const pdsUrl = normalizeServiceEndpoint(await fetchServiceEndpoint(repo));
    if (!pdsUrl) {
        throw new Error(`Cannot detect did[${repo}]'s pds.`);
    }

    return await getRecordFromEndpoint(pdsUrl, repo, rkey);
}

function mirrorStub(c: Context, repo: string) {
    const namespace = (c.env as Env).SKYBLUR_DO_POST_MIRROR;
    return namespace.get(namespace.idFromName(repo));
}

async function getMirrorRecord(c: Context, repo: string, rkey: string): Promise<RecordResult | null> {
    const response = await mirrorStub(c, repo).fetch(
        `https://mirror/record?repo=${encodeURIComponent(repo)}&rkey=${encodeURIComponent(rkey)}`,
    );
    if (response.status === 404) return null;
    if (response.status === 410) throw new MirrorDeletedError('Mirror record is deleted');
    if (!response.ok) throw new Error(`Mirror read failed: ${response.status}`);
    const record = await response.json() as RecordResult;
    record.mirrorTiming = response.headers.get('X-Skyblur-Mirror-DO-Timing') ?? undefined;
    return record;
}

function snapshotTimeUs(): number {
    return Date.now() * 1_000;
}

async function storePdsRecord(
    c: Context,
    repo: string,
    rkey: string,
    record: RecordResult,
): Promise<{ projected: boolean; duplicate: boolean; stale: boolean }> {
    const timeUs = snapshotTimeUs();
    const eventId = pdsCacheEventId(repo, rkey, record.cid, timeUs);
    const response = await mirrorStub(c, repo).fetch('https://mirror/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            eventId,
            did: repo,
            timeUs,
            kind: 'commit',
            source: 'pds',
            commit: {
                operation: 'create',
                collection: 'uk.skyblur.post',
                rkey,
                cid: record.cid,
                record: record.value,
            },
        }),
    });
    if (!response.ok) throw new Error(`Mirror write failed: ${response.status}`);
    const result = await response.json() as {
        accepted?: boolean; projected?: boolean; duplicate?: boolean; stale?: boolean;
    };
    if (result.accepted !== true) throw new Error('Mirror write was not accepted');
    return {
        projected: result.projected === true,
        duplicate: result.duplicate === true,
        stale: result.stale === true,
    };
}

async function shadowCompareRecord(c: Context, repo: string, rkey: string, mirrorValue: unknown) {
    const env = c.env as Env;
    if (env.MIRROR_SHADOW_READ !== 'true') return;
    try {
        const pds = await getSkyblurRecord(repo, rkey);
        if (JSON.stringify(mirrorValue) !== JSON.stringify(pds.value)) {
            console.warn(`[mirror-shadow] record mismatch repo=${repo} rkey=${rkey}`);
        }
    } catch (error) {
        console.warn('[mirror-shadow] comparison failed', error);
    }
}

async function getRestrictedContent(c: Context, repo: string, rkey: string) {
    const doNamespace = (c.env as any).SKYBLUR_DO_RESTRICTED as DurableObjectNamespace;
    const doId = doNamespace.idFromName(repo);
    const stub = doNamespace.get(doId);
    return await stub.fetch(new Request('http://do/get?key=' + rkey));
}

export const handle = async (c: Context) => {
    const requestId = crypto.randomUUID();
    const startedAt = performance.now();
    const timings: Record<string, number> = {};
    const requestMeta: Record<string, unknown> = { requestId };
    const finish = (response: Response) => {
        timings.total = performance.now() - startedAt;
        console.info('[getPost] timing', { ...requestMeta, timings });
        return response;
    };
    const authorization = c.req.header('Authorization') || ''
    // Auth logic via Utils
    const authStartedAt = performance.now();
    const requesterDid = await getAuthenticatedDid(c, requestId) || '';
    timings.auth = performance.now() - authStartedAt;

    const { uri, password } = await c.req.json() as UkSkyblurPostGetPost.Input
    const decodedUri = decodeURIComponent(uri);


    // 必須パラメータのチェック
    if (!decodedUri) {
        return c.json({ message: 'uri is required.' }, 400);
    }

    // `at://` を削除して `/` で分割
    const cleanedUri = decodedUri.replace("at://", "");
    const parts = cleanedUri.split("/");

    if (parts.length < 3) {
        return c.json({ message: 'Invalid uri format' }, 400);
    }

    const repo = decodeURIComponent(parts[0]);
    const collection = parts[1];
    const rkey = parts[2];
    requestMeta.repo = repo;
    requestMeta.rkey = rkey;
    requestMeta.authenticated = Boolean(requesterDid);
    requestMeta.requesterIsAuthor = requesterDid === repo;

    if (collection !== 'uk.skyblur.post') {
        return c.json({ message: 'Collection should be \'uk.skyblur.post\'.' }, 400);
    }

    let recordObj

    try {
        let recordResult: RecordResult | null = null;
        const mirrorStartedAt = performance.now();
        try {
            recordResult = await getMirrorRecord(c, repo, rkey);
        } catch (error) {
            if (error instanceof MirrorDeletedError) throw error;
            console.warn(`[getPost] Mirror Read Error repo=${repo} rkey=${rkey}`, error);
        }
        timings.mirror = performance.now() - mirrorStartedAt;

        const pdsReadThroughEnabled = (c.env as Env).PDS_READ_THROUGH_CACHE === 'true';
        const shouldUseMirrorRecord = recordResult
            && (recordResult.source !== 'pds'
                || (pdsReadThroughEnabled && recordResult.pdsGeneration === PDS_CACHE_GENERATION));

        if (shouldUseMirrorRecord) {
            recordObj = recordResult.value as UkSkyblurPost.Record;
            requestMeta.mirrorDo = recordResult.mirrorTiming;
            const executionCtx = (c as Context & { executionCtx?: ExecutionContext }).executionCtx;
            if (executionCtx) {
                executionCtx.waitUntil(shadowCompareRecord(c, repo, rkey, recordResult.value));
            }
        } else {
            const pdsStartedAt = performance.now();
            recordResult = await getSkyblurRecord(repo, rkey);
            timings.pds = performance.now() - pdsStartedAt;
            recordObj = recordResult.value as UkSkyblurPost.Record;
            if (pdsReadThroughEnabled) {
                try {
                    const stored = await storePdsRecord(c, repo, rkey, recordResult);
                    if (stored.stale) {
                        const current = await getMirrorRecord(c, repo, rkey);
                        if (current) {
                            recordResult = current;
                            recordObj = current.value as UkSkyblurPost.Record;
                        }
                    }
                } catch (error) {
                    if (error instanceof MirrorDeletedError) throw error;
                    console.warn(`[getPost] Mirror Write Error repo=${repo} rkey=${rkey}`, error);
                }
            }
        }
    } catch (e) {
        console.error(`[getPost] Record Fetch Error: ${e}`);
        return c.json({ message: `Cannot getRecord[${decodedUri}]` }, 500);
    }

    // Visibility checks
    const visibility = recordObj.visibility as string;
    requestMeta.visibility = visibility;


    if (['followers', 'following', 'mutual', 'list'].includes(visibility)) {
        const listUri = recordObj.listUri;
        if (!requesterDid) {

            return finish(c.json({
                text: recordObj.text,
                additional: '',
                message: `Login required. Visibility: ${visibility}`,
                errorCode: 'AuthRequired',
                errorDescription: `Login is required to view this content (Visibility: ${visibility})`,
                createdAt: recordObj.createdAt,
                visibility: visibility,
                listUri
            }));
        }

        let isAuthorized = false;
        let errorCode = '';

        if (requesterDid === repo) {

            isAuthorized = true;
        } else if (visibility === 'list') {
            if (!listUri) {
                errorCode = 'ListUriMissing';
            } else if (!isValidListUri(listUri, repo)) {
                errorCode = 'InvalidListUri';
            } else {
                const result = await checkListMembership({ requesterDid, authorDid: repo, listUri });
                isAuthorized = result.ok;
                errorCode = result.errorCode || '';
            }
        } else {
            // Check relationship
            const relationshipStartedAt = performance.now();
            try {
                const client = new Client({ handler: simpleFetchHandler({ service: 'https://public.api.bsky.app' }) });
                const { data } = await client.get('app.bsky.graph.getRelationships', {
                    params: {
                        actor: requesterDid as ActorIdentifier,
                        others: [repo as ActorIdentifier],
                    },
                    headers: {
                        Authorization: authorization
                    }
                });

                // relationships structure: { actor: did, relationships: [ { did: target, following: uri, followedBy: uri } ] }
                const rel = (data as AppBskyGraphGetRelationships.$output).relationships?.[0];
                if (rel && rel.$type === 'app.bsky.graph.defs#relationship') {
                    // app.bsky.graph.getRelationships returns relationships from the perspective of the 'actor' (requester)
                    // regarding the 'others' (repo/author).

                    // rel.following: If the actor follows this user, this is the AT-URI of the follow record.
                    // => Requester follows Author (閲覧者が投稿者をフォローしている = Authorのフォロワーである)
                    const isFollowing = !!rel.following;

                    // rel.followedBy: If the user follows the actor, this is the AT-URI of the follow record.
                    // => Author follows Requester (投稿者が閲覧者をフォローしている = Authorのフォロイーである)
                    const isFollowedBy = !!rel.followedBy;

                    if (visibility === 'followers') {
                        isAuthorized = isFollowing || requesterDid === repo;
                        if (!isAuthorized) errorCode = 'NotFollower';
                    } else if (visibility === 'following') {
                        isAuthorized = isFollowedBy || requesterDid === repo;
                        if (!isAuthorized) errorCode = 'NotFollowing';
                    } else if (visibility === 'mutual') {
                        isAuthorized = (isFollowing && isFollowedBy) || requesterDid === repo;
                        if (!isAuthorized) errorCode = 'NotMutual';
                    }
                } else {
                    errorCode = 'RelationshipNotFound';
                }
                timings.relationship = performance.now() - relationshipStartedAt;
            } catch (e) {
                timings.relationship = performance.now() - relationshipStartedAt;
                console.error("Error checking relationships", e);
                errorCode = 'RelationshipCheckFailed';
            }
        }

        if (!isAuthorized) {

            return finish(c.json({
                text: recordObj.text,
                additional: '',
                message: `Not authorized. Requester: ${requesterDid}, Repo: ${repo}, Visibility: ${visibility}`,
                errorCode: errorCode || 'NotAuthorized',
                errorDescription: `One of the requirements is not met: ${visibility}`,
                createdAt: recordObj.createdAt,
                visibility: visibility,
                listUri
            }));
        }

        // Authorized: Fetch content from DO
        try {
            const restrictedStartedAt = performance.now();
            const doRes = await getRestrictedContent(c, repo, rkey);
            timings.restricted = performance.now() - restrictedStartedAt;
            requestMeta.restrictedDo = doRes.headers?.get?.('X-Skyblur-Restricted-DO-Timing');
            if (doRes.ok) {
                const data = await doRes.json() as { text: string, additional: string, visibility?: string, listUri?: string };
                return finish(c.json({
                    text: data.text,
                    additional: data.additional,
                    createdAt: recordObj.createdAt,
                    visibility: data.visibility || visibility,
                    listUri: data.listUri || listUri
                }));
            } else {
                return finish(c.json({
                    text: recordObj.text,
                    additional: '',
                    message: "Content missing in DO",
                    errorCode: 'ContentMissing',
                    errorDescription: 'The content could not be retrieved from the authorized storage.',
                    createdAt: recordObj.createdAt,
                    visibility: visibility,
                    listUri
                }));
            }
        } catch (e) {
            console.error("DO Fetch Error", e);
            return c.json({ message: "Internal server error fetching content." }, 500);
        }
    }

    // Previous password logic
    if (recordObj.visibility === 'password') {
        // Define a minimal interface for the Blob structure we expect
        const blob = recordObj.encryptBody as any;
        let refLink = blob?.ref?.toString();

        // Handle raw JSON IPLD link format
        if (blob?.ref?.['$link']) {
            refLink = blob.ref['$link'];
        }

        if (!refLink || refLink === '[object Object]') {
            // Fallback or specific error if needed, but primarily ensure we have a string
            if (typeof blob?.ref === 'string') {
                refLink = blob.ref;
            }
        }

        if (!refLink || refLink === '[object Object]') {
            console.error(`[getPost] Invalid refLink extracted:`, blob?.ref);
            return c.json({ message: 'Reference link is missing or invalid in the record.' }, 500);
        }

        if (!password) {
            return c.json({
                text: recordObj.text,
                additional: '',
                message: "A password is required because the visibility of this post is set to 'password'.",
                errorCode: 'PasswordRequired',
                errorDescription: 'Password is required to view this content.',
                createdAt: recordObj.createdAt,
                visibility: 'password',
                encryptCid: refLink
            });
        }

        try {
            let pdsUrl: string
            try {
                const endpoint = normalizeServiceEndpoint(await fetchServiceEndpoint(repo));
                if (endpoint) {
                    pdsUrl = endpoint;
                } else {
                    console.error(`[getPost] Invalid PDS endpoint format: ${JSON.stringify(endpoint)}`);
                    throw new Error('Invalid PDS endpoint format');
                }

                if (!pdsUrl) throw new Error('Failed to get PDS URL')
            } catch (e) {
                console.error(`[getPost] PDS Fetch Error: ${e}`);
                return c.json({ message: `Cannot detect did[${repo}]'s pds.` }, 500);
            }

            const result = await getDecrypt(pdsUrl, repo, refLink, password)
            return c.json({
                text: result.text,
                additional: result.additional,
                createdAt: recordObj.createdAt,
                visibility: visibility
            })
        } catch (e: any) {
            return c.json({ message: e.message || "Decrypt failed." }, 403);
        }
    }

    // Fallback for public or other types?
    return finish(c.json({
        text: recordObj.text,
        additional: recordObj.additional,
        createdAt: recordObj.createdAt,
        visibility: visibility
    }));

}
