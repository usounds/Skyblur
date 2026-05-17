import { UkSkyblurPostDecryptByCid } from '@/lexicon/UkSkyblur'
import { getDecrypt } from '@/logic/CryptHandler'
import { fetchServiceEndpoint } from '@/logic/JWTTokenHandler'
import { Context } from 'hono'

function normalizeServiceEndpoint(endpoint: unknown): string | null {
    if (typeof endpoint === 'string') {
        return endpoint;
    }

    if (Array.isArray(endpoint) && typeof endpoint[0] === 'string') {
        return endpoint[0];
    }

    return null;
}

function getAtprotoPdsEndpoint(didDoc: any): string | null {
    const service = didDoc?.service?.find((s: any) =>
        s.id === '#atproto_pds' || s.type === 'AtprotoPersonalDataServer'
    );
    return normalizeServiceEndpoint(service?.serviceEndpoint);
}

export const handle = async (c: Context) => {
    let { pds, repo, cid, password } = await c.req.json() as UkSkyblurPostDecryptByCid.Input
    const env = c.env as any;

    // pdsが空の場合、キャッシュまたは DID から直接解決を試みる
    if (!pds && repo) {
        const cacheKey = `diddoc_${repo}`;
        try {
            const doNamespace = env.SKYBLUR_DO;
            const doId = doNamespace?.idFromName('global_cache');
            const stub = doId ? doNamespace.get(doId) : null;

            let didDoc: any = null;

            if (stub) {
                const res = await stub.fetch(new Request(`http://do/cache?key=${encodeURIComponent(cacheKey)}`));
                if (res.ok) {
                    didDoc = await res.json();
                }
            }

            if (!didDoc && repo.startsWith('did:plc:')) {

                const res = await fetch(`https://plc.directory/${encodeURIComponent(repo)}`);
                if (res.ok) {
                    didDoc = await res.json();
                    if (stub) {
                        c.executionCtx.waitUntil(
                            stub.fetch(new Request(`http://do/cache?key=${encodeURIComponent(cacheKey)}`, {
                                method: 'PUT',
                                body: JSON.stringify(didDoc)
                            }))
                        );
                    }
                }
            }

            if (didDoc) {
                pds = getAtprotoPdsEndpoint(didDoc) || pds;
            }
        } catch (e) {
            console.error('Failed to resolve PDS from cache/directory in decryptByCid:', e);
        }
    }

    if (!pds && repo) {
        try {
            pds = normalizeServiceEndpoint(await fetchServiceEndpoint(repo)) || pds;
        } catch (e) {
            console.error('Failed to resolve PDS from DID resolver in decryptByCid:', e);
        }
    }

    if (!pds) {
        return c.json({ message: 'pds is required and could not be resolved.' }, 500);
    }
    if (!repo) {
        return c.json({ message: 'repo is required.' }, 500);
    }
    if (!cid) {
        return c.json({ message: 'cid is required.' }, 500);
    }
    if (!password) {
        return c.json({ message: 'password is required.' }, 500);
    }

    try {
        const result = await getDecrypt(pds, repo, cid, password)
        return c.json(result)
    } catch (e: any) {
        return c.json({ message: e.message || "Decrypt failed." }, 403);
    }

}
