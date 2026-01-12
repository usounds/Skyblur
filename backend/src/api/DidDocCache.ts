import { getResolver as getPlcResolver } from '@/logic/DidPlcResolver';
import { Resolver } from 'did-resolver';
import { Context } from 'hono';
import { getResolver as getWebResolver } from 'web-did-resolver';

export async function handle(c: Context) {
  const did = c.req.query('actor');
  const forceRefresh = c.req.query('forceRefresh');

  if (!did) {
    return c.json({ error: 'Missing did parameter' }, 400);
  }
  if (forceRefresh === null) {
    return c.json({ error: 'Missing forceRefresh parameter' }, 400);
  }

  const doNamespace = c.env.SKYBLUR_DO;
  if (!doNamespace) {
    return c.json({ error: 'DO binding not found' }, 500);
  }

  const doId = doNamespace.idFromName('global_cache');
  const stub = doNamespace.get(doId);
  const cacheKey = `diddoc_${did}`;

  try {
    // キャッシュから取得
    if (forceRefresh === 'false') {
      const res = await stub.fetch(new Request(`http://do/cache?key=${encodeURIComponent(cacheKey)}`));
      if (res.ok) {
        const cachedDoc = await res.json();
        return c.json(cachedDoc);
      }
    }

    // --- 正しい Resolver の組み立て ---
    const resolverInstance = new Resolver({
      ...getPlcResolver(),
      ...getWebResolver(),
    });

    const didDocument = await resolverInstance.resolve(did);

    // DOに保存（非同期）
    c.executionCtx.waitUntil(
      stub.fetch(new Request(`http://do/cache?key=${encodeURIComponent(cacheKey)}`, {
        method: 'PUT',
        body: JSON.stringify(didDocument.didDocument)
      }))
    );

    return c.json(didDocument.didDocument);

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return c.json({ error: message }, 500);
  }
}
