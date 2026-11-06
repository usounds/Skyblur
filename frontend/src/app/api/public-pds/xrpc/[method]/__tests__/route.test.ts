import { beforeEach, expect, it, vi } from 'vitest';
const { resolvePublicPds, readPublicUrl } = vi.hoisted(() => ({ resolvePublicPds: vi.fn(), readPublicUrl: vi.fn() }));
vi.mock('@/logic/publicPds.server', () => ({ resolvePublicPds, readPublicUrl }));
import { GET } from '../route';

const did = 'did:plc:46djceokmoinn2ysovilvgty';
const cid = 'bafkreibw5bylt5licwsxlaygby4n6pi7xlresjkzlpof5vo36pytoh3ugi';
const record = `repo=${did}&collection=uk.skyblur.preference&rkey=self`;
const list = `repo=${did}&collection=uk.skyblur.post&limit=10&cursor=next`;
function get(method = 'com.atproto.repo.getRecord', query = record) {
  return GET(new Request(`https://skyblur.uk/api/public-pds/xrpc/${method}?${query}`, { headers: { cookie: 'secret', authorization: 'Bearer secret' } }), { params: Promise.resolve({ method }) });
}
beforeEach(() => { vi.clearAllMocks(); resolvePublicPds.mockResolvedValue(new URL('https://pds.example.com')); });

it('reads public preferences anonymously and preserves RecordNotFound', async () => {
  readPublicUrl.mockResolvedValue(Response.json({ error: 'RecordNotFound' }, { status: 400 }));
  const response = await get();
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: 'RecordNotFound' });
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(readPublicUrl.mock.calls[0][0].searchParams.get('repo')).toBe(did);
  expect(readPublicUrl.mock.calls[0]).toHaveLength(3);
});

it('checks the opt-in before listing and preserves pagination', async () => {
  readPublicUrl.mockResolvedValueOnce(Response.json({ value: { myPage: { isUseMyPage: true } } }))
    .mockResolvedValueOnce(Response.json({ records: [], cursor: 'next-page' }));
  const response = await get('com.atproto.repo.listRecords', list);
  expect(await response.json()).toEqual({ records: [], cursor: 'next-page' });
  expect(readPublicUrl.mock.calls[1][0].searchParams.get('cursor')).toBe('next');
});

it('does not read posts when the page is private', async () => {
  readPublicUrl.mockResolvedValue(Response.json({ value: { myPage: { isUseMyPage: false } } }));
  expect((await get('com.atproto.repo.listRecords', list)).status).toBe(403);
  expect(readPublicUrl).toHaveBeenCalledTimes(1);
});

it.each([
  ['com.atproto.repo.getRecord', record.replace('uk.skyblur.preference', 'app.bsky.actor.profile')],
  ['com.atproto.repo.getRecord', `${record}&url=https://internal`],
  ['com.atproto.repo.getRecord', `${record}&repo=${did}`],
  ['com.atproto.repo.listRecords', list.replace('limit=10', 'limit=101')],
  ['com.atproto.repo.listRecords', list.replace('uk.skyblur.post', 'app.bsky.feed.post')],
  ['com.atproto.sync.getBlob', `did=${did}&cid=invalid`],
])('rejects unsupported inputs for %s', async (method, query) => {
  expect((await get(method, query)).status).toBe(400);
  expect(resolvePublicPds).not.toHaveBeenCalled();
});

it('rejects non-read methods', async () => {
  expect((await get('com.atproto.repo.applyWrites')).status).toBe(404);
  expect(resolvePublicPds).not.toHaveBeenCalled();
});

it('serves images with nosniff and rejects active document content', async () => {
  readPublicUrl.mockResolvedValueOnce(new Response('image', { headers: { 'content-type': 'image/png' } }));
  const response = await get('com.atproto.sync.getBlob', `did=${did}&cid=${cid}`);
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  expect(await response.text()).toBe('image');
  readPublicUrl.mockResolvedValueOnce(new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } }));
  expect((await get('com.atproto.sync.getBlob', `did=${did}&cid=${cid}`)).status).toBe(415);
});

it('reports upstream failures without falling back to unpublished data', async () => {
  resolvePublicPds.mockRejectedValue(new Error('network failed'));
  expect((await get()).status).toBe(502);
  expect(readPublicUrl).not.toHaveBeenCalled();
});
