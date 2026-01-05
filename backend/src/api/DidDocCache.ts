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

  const kv = c.env.SKYBLUR_KV_CACHE;
  if (!kv) {
    return c.json({ error: 'KV binding not found' }, 500);
  }

  const cacheKey = `diddoc_${did}`;

  try {
    // キャッシュから取得
    if (forceRefresh === 'false') {
      const cachedDoc = await kv.get(cacheKey, { type: 'json' });
      if (cachedDoc) {
        return c.json(cachedDoc);
      }
    }

    // --- 正しい Resolver の組み立て ---
    const resolverInstance = new Resolver({
      ...getPlcResolver(),
      ...getWebResolver(),
    });

    const didDocument = await resolverInstance.resolve(did);

    // KVに保存（非同期）
    c.executionCtx.waitUntil(
      kv.put(cacheKey, JSON.stringify(didDocument.didDocument))
    );

    return c.json(didDocument.didDocument);

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return c.json({ error: message }, 500);
  }
}
