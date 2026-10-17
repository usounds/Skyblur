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
import { readResponseText } from '@/logic/boundedBody'
import { pdsReadCache } from './pdsReadCache'

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
    const signal = AbortSignal.timeout(10_000);
    const result = await fetch(recordUrl, {
        signal,
        headers: {
            'Accept': 'application/json',
            'User-Agent': 'SkyblurAPI/1.0',
        },
    });

    if (!result.ok) {
        const errText = await readResponseText(result, 4096, signal);
        console.error(`[getPost] getRecord failed: ${result.status} ${errText} URL: ${recordUrl}`);
        throw new Error(`Failed to get record from ${recordUrl}`);
    }

    const record = JSON.parse(await readResponseText(result, 64 * 1024, signal)) as { value: unknown; cid?: unknown };
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
            && recordResult.source !== 'pds';

        if (shouldUseMirrorRecord && recordResult) {
            recordObj = recordResult.value as UkSkyblurPost.Record;
            requestMeta.mirrorDo = recordResult.mirrorTiming;
            const executionCtx = (c as Context & { executionCtx?: ExecutionContext }).executionCtx;
            if (executionCtx) {
                executionCtx.waitUntil(shadowCompareRecord(c, repo, rkey, recordResult.value));
            }
        } else {
            const pdsStartedAt = performance.now();
            recordResult = (pdsReadThroughEnabled ? pdsReadCache.get(repo, rkey) : undefined)
                ?? await getSkyblurRecord(repo, rkey);
            timings.pds = performance.now() - pdsStartedAt;
            recordObj = recordResult.value as UkSkyblurPost.Record;
            // A concurrent canonical projection or tombstone wins over this PDS snapshot.
            let current: RecordResult | null = null;
            try { current = await getMirrorRecord(c, repo, rkey); }
            catch (error) {
                if (error instanceof MirrorDeletedError) throw error;
                // A fresh PDS response can still be served during a mirror outage.
                recordResult = await getSkyblurRecord(repo, rkey);
                recordObj = recordResult.value as UkSkyblurPost.Record;
            }
            if (current && current.source !== 'pds') {
                recordObj = current.value as UkSkyblurPost.Record;
            } else if (pdsReadThroughEnabled) {
                pdsReadCache.set(repo, rkey, recordResult);
            }

        }
    } catch (e) {
        console.error(`[getPost] Record Fetch Error: ${e}`);
        return c.json({ message: `Cannot getRecord[${decodedUri}]` }, 500);
    }

    // A leftover restricted entry may belong to an older revision. Resolve conflicts
    // against the PDS instead of serving either cached plaintext on an ambiguous ACL.
    if (recordObj.visibility === 'public' && (c.env as Env).SKYBLUR_DO_RESTRICTED) {
        let requiresVerification = false;
        try {
            const response = await getRestrictedContent(c, repo, rkey);
            if (response?.ok) {
                const stored = await response.json() as { visibility?: string };
                requiresVerification = stored.visibility !== 'public';
            } else {
                requiresVerification = response?.status !== 404;
            }
        } catch {
            requiresVerification = true;
        }
        if (requiresVerification) {
            try {
                recordObj = (await getSkyblurRecord(repo, rkey)).value as UkSkyblurPost.Record;
            } catch {
                return c.json({ message: 'Cannot verify current post visibility.' }, 503);
            }
        }
    }

    // Visibility checks
    const visibility = recordObj.visibility as string;
    requestMeta.visibility = visibility;

    const checkAuth = async (targetVis: string, targetList: string | undefined) => {
        if (requesterDid === repo) {
            return { isAuthorized: true, errorCode: '' };
        }
        if (targetVis === 'list') {
            if (!targetList) {
                return { isAuthorized: false, errorCode: 'ListUriMissing' };
            }
            if (!isValidListUri(targetList, repo)) {
                return { isAuthorized: false, errorCode: 'InvalidListUri' };
            }
            const result = await checkListMembership({ requesterDid, authorDid: repo, listUri: targetList });
            return { isAuthorized: result.ok, errorCode: result.errorCode || '' };
        }
        if (['followers', 'following', 'mutual'].includes(targetVis)) {
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
                timings.relationship = performance.now() - relationshipStartedAt;

                const rel = (data as AppBskyGraphGetRelationships.$output).relationships?.[0];
                if (rel && rel.$type === 'app.bsky.graph.defs#relationship') {
                    const isFollowing = !!rel.following;
                    const isFollowedBy = !!rel.followedBy;

                    if (targetVis === 'followers') {
                        const isAuthorized = isFollowing || requesterDid === repo;
                        return { isAuthorized, errorCode: isAuthorized ? '' : 'NotFollower' };
                    } else if (targetVis === 'following') {
                        const isAuthorized = isFollowedBy || requesterDid === repo;
                        return { isAuthorized, errorCode: isAuthorized ? '' : 'NotFollowing' };
                    } else if (targetVis === 'mutual') {
                        const isAuthorized = (isFollowing && isFollowedBy) || requesterDid === repo;
                        return { isAuthorized, errorCode: isAuthorized ? '' : 'NotMutual' };
                    }
                }
                return { isAuthorized: false, errorCode: 'RelationshipNotFound' };
            } catch (e) {
                timings.relationship = performance.now() - relationshipStartedAt;
                console.error("Error checking relationships", e);
                return { isAuthorized: false, errorCode: 'RelationshipCheckFailed' };
            }
        }
        return { isAuthorized: true, errorCode: '' };
    };

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

        const authResult = await checkAuth(visibility, listUri);
        if (!authResult.isAuthorized) {
            return finish(c.json({
                text: recordObj.text,
                additional: '',
                message: `Not authorized. Requester: ${requesterDid}, Repo: ${repo}, Visibility: ${visibility}`,
                errorCode: authResult.errorCode || 'NotAuthorized',
                errorDescription: `One of the requirements is not met: ${visibility}`,
                createdAt: recordObj.createdAt,
                visibility: visibility,
                listUri
            }));
        }

        // Authorized for recordObj.visibility: Fetch content from DO
        try {
            const restrictedStartedAt = performance.now();
            const doRes = await getRestrictedContent(c, repo, rkey);
            timings.restricted = performance.now() - restrictedStartedAt;
            requestMeta.restrictedDo = doRes?.headers?.get?.('X-Skyblur-Restricted-DO-Timing');
            if (doRes && doRes.ok) {
                const data = await doRes.json() as { text: string, additional: string, visibility?: string, listUri?: string };

                // Re-verify authorization if DO visibility was edited to a different restricted ACL (prevent new plaintext leak under old ACL)
                if (data.visibility && (data.visibility !== visibility || (data.visibility === 'list' && data.listUri !== listUri)) && ['followers', 'following', 'mutual', 'list'].includes(data.visibility)) {
                    const reAuth = await checkAuth(data.visibility, data.listUri);
                    if (!reAuth.isAuthorized) {
                        return finish(c.json({
                            text: recordObj.text,
                            additional: '',
                            message: `Not authorized. Requester: ${requesterDid}, Repo: ${repo}, Visibility: ${data.visibility}`,
                            errorCode: reAuth.errorCode || 'NotAuthorized',
                            errorDescription: `One of the requirements is not met: ${data.visibility}`,
                            createdAt: recordObj.createdAt,
                            visibility: data.visibility,
                            listUri: data.listUri
                        }));
                    }
                }

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
