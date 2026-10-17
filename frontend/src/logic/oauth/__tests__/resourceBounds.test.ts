import { afterEach, expect, it, vi } from 'vitest';
const store = vi.hoisted(() => ({ set: vi.fn(), get: vi.fn() }));
vi.mock('../dynamo-store', () => ({ DynamoOAuthStore: class { set = store.set; get = store.get; }, requestOAuthLock: vi.fn() }));
import { guardedOAuthFetch } from '../client';
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('rejects oversized OAuth metadata before caching or retrying it', async () => {
  const fetchMock = vi.fn(async () => new Response('x'.repeat(1025)));
  vi.stubGlobal('fetch', fetchMock);
  await expect(guardedOAuthFetch('https://pds.example.com/.well-known/oauth-protected-resource')).rejects.toThrow('Body size limit');
  expect(store.set).not.toHaveBeenCalled(); expect(fetchMock).toHaveBeenCalledOnce();
});
it('cancels a stalled metadata body using the caller signal', async () => {
  const controller = new AbortController();
  const cancel = vi.fn();
  const fetchMock = vi.fn(async () => new Response(new ReadableStream({ pull: () => new Promise<void>(() => {}), cancel })));
  vi.stubGlobal('fetch', fetchMock);
  const pending = guardedOAuthFetch('https://pds.example.com/.well-known/oauth-protected-resource', { signal: controller.signal });
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(store.set).not.toHaveBeenCalled(); expect(fetchMock).toHaveBeenCalledOnce();
});
it('rejects previously cached oversized metadata on fallback', async () => {
  store.get.mockResolvedValue({ body: 'x'.repeat(1025), contentType: 'application/json' });
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  await expect(guardedOAuthFetch('https://pds.example.com/.well-known/oauth-protected-resource')).rejects.toThrow('offline');
});

it('keeps authenticated large XRPC lists streaming', async () => {
  const body = JSON.stringify({ records: Array.from({ length: 100 }, () => ({ value: { text: 'x'.repeat(1000) } })) });
  const upstream = new Response(body, { headers: { 'content-type': 'application/json' } });
  vi.stubGlobal('fetch', vi.fn(async () => upstream));
  const response = await guardedOAuthFetch('https://pds.example.com/xrpc/com.atproto.repo.listRecords', { headers: { Authorization: 'DPoP synthetic-access-token' } });
  expect(response).toBe(upstream); expect(response.bodyUsed).toBe(false);
  expect(await response.text()).toBe(body);
});
it('preserves authenticated binary XRPC responses byte-for-byte', async () => {
  const bytes = new Uint8Array([0, 128, 255, 192, 175]);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(bytes)));
  const response = await guardedOAuthFetch('https://pds.example.com/xrpc/com.atproto.sync.getBlob', { headers: { Authorization: 'DPoP synthetic-access-token' } });
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
});
it('cannot bypass discovery bounds merely by choosing an XRPC-shaped endpoint', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('x'.repeat(65 * 1024))));
  await expect(guardedOAuthFetch('https://pds.example.com/xrpc/com.example.metadata')).rejects.toThrow('Body size limit');
});
