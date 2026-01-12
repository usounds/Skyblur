import { UkSkyblurPostDecryptByCid } from '@/lexicon/UkSkyblur'
import { getDecrypt } from '@/logic/CryptHandler'
import { Context } from 'hono'

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
                const service = didDoc.service?.find((s: any) => s.type === 'AtprotoPersonalDataServer');
                if (service) {
                    pds = service.serviceEndpoint;

                }
            }
        } catch (e) {
            console.error('Failed to resolve PDS from cache/directory in decryptByCid:', e);
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

    return await getDecrypt(c, pds, repo, cid, password)

}