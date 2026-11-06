import { resolvePublicPds, readPublicUrl } from '@/logic/publicPds.server';

export const runtime = 'nodejs';

function json(data: unknown, status: number) {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

export async function GET(request: Request, context: { params: Promise<{ method: string }> }) {
  const { method } = await context.params;
  const input = new URL(request.url).searchParams;
  const params = new URLSearchParams();
  const did = input.get(method === 'com.atproto.sync.getBlob' ? 'did' : 'repo');
  if (!did || did.length > 2048 || !/^did:(plc|web):/.test(did)) return json({ error: 'InvalidRequest' }, 400);
  const allowed = new Set<string>();
  if (method === 'com.atproto.repo.getRecord') {
    if (input.get('collection') !== 'uk.skyblur.preference' || input.get('rkey') !== 'self') return json({ error: 'InvalidRequest' }, 400);
    for (const key of ['repo', 'collection', 'rkey']) allowed.add(key);
  } else if (method === 'com.atproto.repo.listRecords') {
    if (input.get('collection') !== 'uk.skyblur.post') return json({ error: 'InvalidRequest' }, 400);
    const limit = input.get('limit');
    if (limit && (!/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 100)) return json({ error: 'InvalidRequest' }, 400);
    if ((input.get('cursor')?.length ?? 0) > 2048) return json({ error: 'InvalidRequest' }, 400);
    for (const key of ['repo', 'collection', 'limit', 'cursor']) allowed.add(key);
  } else if (method === 'com.atproto.sync.getBlob') {
    if (!/^b[a-z2-7]{10,200}$/.test(input.get('cid') ?? '')) return json({ error: 'InvalidRequest' }, 400);
    for (const key of ['did', 'cid']) allowed.add(key);
  } else return json({ error: 'MethodNotAllowed' }, 404);
  for (const [key, value] of input) {
    if (!allowed.has(key) || input.getAll(key).length !== 1) return json({ error: 'InvalidRequest' }, 400);
    params.set(key, value);
  }
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]);
  try {
    const pds = await resolvePublicPds(did, signal);
    // The public page opt-in is checked for every page of the list.
    if (method === 'com.atproto.repo.listRecords') {
      const preferenceUrl = new URL('/xrpc/com.atproto.repo.getRecord', pds);
      preferenceUrl.search = new URLSearchParams({ repo: did, collection: 'uk.skyblur.preference', rkey: 'self' }).toString();
      const preference = await readPublicUrl(preferenceUrl, 256 * 1024, signal);
      if (!preference.ok) return json({ error: 'ProfileUnavailable' }, preference.status === 400 || preference.status === 404 ? 403 : 502);
      const data = await preference.json() as { value?: { myPage?: { isUseMyPage?: boolean } } };
      if (data.value?.myPage?.isUseMyPage !== true) return json({ error: 'ProfileNotPublished' }, 403);
    }
    const url = new URL(`/xrpc/${method}`, pds);
    url.search = params.toString();
    const response = await readPublicUrl(url, method === 'com.atproto.sync.getBlob' ? 5 * 1024 * 1024 : 2 * 1024 * 1024, signal);
    const contentType = response.headers.get('content-type') ?? '';
    if (method === 'com.atproto.sync.getBlob') {
      if (response.ok && !/^image\/(png|jpeg|webp|gif|avif)(;|$)/i.test(contentType)) return json({ error: 'UnsupportedImage' }, 415);
    } else if (!contentType.toLowerCase().startsWith('application/json')) return json({ error: 'InvalidUpstreamResponse' }, 502);
    return new Response(response.body, { status: response.status, headers: {
      'content-type': contentType, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
    } });
  } catch (error) {
    console.warn('[public-pds] Read failed', error instanceof Error ? error.name : 'UnknownError');
    return json({ error: signal.aborted ? 'UpstreamTimeout' : 'UpstreamUnavailable' }, signal.aborted ? 504 : 502);
  }
}
