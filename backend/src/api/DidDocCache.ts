import { Context } from 'hono';
import { DIDDocument, DIDResolver, Resolver, ResolverRegistry } from 'did-resolver';
import { getResolver as getWebResolver } from 'web-did-resolver';
import { getResolver } from '@/logic/DidPlcResolver';

export async function handle(c: Context) {
  const did = c.req.query('actor');
  const forceRefresh = c.req.query('forceRefresh');
  if (!did) {
    return c.json({ error: 'Missing did parameter' }, 400);
  }

  // KVバインディング (例: binding名は SKYBLUR_KV_CACHE と仮定)
  const kv = c.env.SKYBLUR_KV_CACHE;
  if (!kv) {
    return c.json({ error: 'KV binding not found' }, 500);
  }

  const cacheKey = `diddoc_${did}`;

  try {
    // KVからキャッシュ取得
    if (forceRefresh === 'false') {
      let cachedDoc = await kv.get(cacheKey, { type: 'json' });
      if (cachedDoc) {
        return c.json(cachedDoc);
      }
    }

    // キャッシュがなければDIDドキュメントを解決
    const myResolver = getResolver();
    const web = getWebResolver();
    const resolver: ResolverRegistry = {
      'plc': myResolver.DidPlcResolver as unknown as DIDResolver,
      'web': web as unknown as DIDResolver,
    };
    const resolverInstance = new Resolver(resolver);

    const didDocument = await resolverInstance.resolve(did);

    // KVにキャッシュ保存（JSONで保存）
    await kv.put(cacheKey, JSON.stringify(didDocument));

    return c.json(didDocument);

  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    return c.json({ error: errorMessage }, 500);
  }
}
