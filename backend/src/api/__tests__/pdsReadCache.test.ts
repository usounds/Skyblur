import { expect, it } from 'vitest';
import { PdsReadCache, PDS_CACHE_TTL_MS, PDS_CACHE_MAX_BYTES, PDS_CACHE_MAX_ENTRIES } from '../pdsReadCache';
it('expires at the fixed TTL without extending it on reads', () => {
  const cache = new PdsReadCache();
  cache.set('did:one', 'key', { value: { text: 'hello' } }, 0);
  expect(cache.get('did:one', 'key', PDS_CACHE_TTL_MS - 1)).toBeDefined();
  expect(cache.get('did:one', 'key', PDS_CACHE_TTL_MS)).toBeUndefined();
});
it('evicts least recently used entries at the count limit', () => {
  const cache = new PdsReadCache();
  for (let i = 0; i < PDS_CACHE_MAX_ENTRIES; i++) cache.set('did:one', String(i), { value: { text: 'hello' } }, 0);
  cache.get('did:one', '0', 0);
  cache.set('did:one', 'new', { value: {} }, 0);
  expect(cache.get('did:one', '0', 0)).toBeDefined();
  expect(cache.get('did:one', '1', 0)).toBeUndefined();
});
it('bounds aggregate bytes and rejects oversized individual entries', () => {
  const cache = new PdsReadCache(); const text = 'x'.repeat(60 * 1024);
  for (let i = 0; i < 200; i++) cache.set('did:one', String(i), { value: { text } }, 0);
  const remaining = Array.from({ length: 200 }, (_, i) => cache.get('did:one', String(i), 0)).filter(Boolean);
  expect(remaining.length * text.length).toBeLessThanOrEqual(PDS_CACHE_MAX_BYTES);
  expect(cache.get('did:one', '199', 0)).toBeDefined();
  cache.set('did:one', 'oversized', { value: { text: text.repeat(2) } }, 0);
  expect(cache.get('did:one', 'oversized', 0)).toBeUndefined();
});
it('keeps different repos separate and returns detached values', () => {
  const cache = new PdsReadCache();
  cache.set('did:one', 'key', { value: { text: 'one' } }, 0);
  cache.set('did:two', 'key', { value: { text: 'two' } }, 0);
  (cache.get('did:one', 'key', 0)!.value as { text: string }).text = 'changed';
  expect(cache.get('did:one', 'key', 0)!.value).toEqual({ text: 'one' });
  expect(cache.get('did:two', 'key', 0)!.value).toEqual({ text: 'two' });
});
