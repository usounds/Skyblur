import { afterEach, expect, it, vi } from 'vitest';
vi.mock('next/headers', () => ({ headers: async () => new Headers({ host: 'skyblur.uk' }) }));
import { resolveHandleAction } from '../HandleResolverAction';
afterEach(() => vi.unstubAllGlobals());
it('resolves a normal DID document', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('did:plc:abcdefghijklmnopqrstuvwx\n')));
  expect(await resolveHandleAction('pds.example.com')).toMatchObject({ ok: true, did: 'did:plc:abcdefghijklmnopqrstuvwx' });
});
it('rejects oversized responses even if the first line contains a valid DID', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('did:plc:abcdefghijklmnopqrstuvwx\n' + 'x'.repeat(2048))));
  expect(await resolveHandleAction('pds.example.com')).toMatchObject({ ok: false });
});
