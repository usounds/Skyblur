import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

const { lookup, request } = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock('node:dns/promises', () => ({ lookup }));
vi.mock('node:https', () => ({ request }));
import { isPublicAddress, readPublicUrl, resolvePublicPds } from '../publicPds.server';

const did = 'did:plc:46djceokmoinn2ysovilvgty';
function upstream(body: string, status = 200, headers = { 'content-type': 'application/json' }) {
  request.mockImplementationOnce((_url, options, callback) => {
    const req = new EventEmitter() as EventEmitter & { end: () => void };
    req.end = () => {
      const response = Object.assign(new PassThrough(), { statusCode: status, headers });
      callback(response);
      response.end(body);
    };
    // Node may request all addresses; disable auto-selection by supplying one address.
    options.lookup('pds.example.com', {}, (_error: unknown, address: string, family: number) => {
      expect(address).toBe('8.8.8.8');
      expect(family).toBe(4);
    });
    options.lookup('pds.example.com', { all: true }, (_error: unknown, addresses: unknown) => {
      expect(addresses).toEqual([{ address: '8.8.8.8', family: 4 }]);
    });
    return req;
  });
}

beforeEach(() => { vi.clearAllMocks(); lookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }]); });
afterEach(() => { vi.restoreAllMocks(); });

describe('public PDS connection boundary', () => {
  it.each(['127.0.0.1', '10.1.2.3', '169.254.169.254', '100.64.0.1', '192.168.1.1', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '2001:db8::1', '2002:7f00:1::'])('rejects %s', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });
  it.each(['8.8.8.8', '2606:4700:4700::1111'])('allows public %s', (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });
  it('rejects mixed public/private DNS answers before connecting', async () => {
    lookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }]);
    await expect(readPublicUrl(new URL('https://pds.example.com'), 1024, AbortSignal.timeout(1000))).rejects.toThrow('Unsafe');
    expect(request).not.toHaveBeenCalled();
  });
  it('pins DNS and sends no browser credentials', async () => {
    upstream('{"ok":true}');
    const response = await readPublicUrl(new URL('https://pds.example.com/xrpc/test'), 1024, AbortSignal.timeout(1000));
    expect(await response.json()).toEqual({ ok: true });
    expect(request.mock.calls[0][1]).toMatchObject({ agent: false, method: 'GET', headers: { 'accept-encoding': 'identity' } });
    expect(request.mock.calls[0][1].headers.authorization).toBeUndefined();
  });
  it('rejects redirects without following them', async () => {
    upstream('', 302);
    await expect(readPublicUrl(new URL('https://pds.example.com'), 1024, AbortSignal.timeout(1000))).rejects.toThrow('redirect');
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('bounds streamed response bytes', async () => {
    upstream('too large');
    await expect(readPublicUrl(new URL('https://pds.example.com'), 3, AbortSignal.timeout(1000))).rejects.toThrow('Body size');
  });
  it('bounds DNS resolution time', async () => {
    lookup.mockReturnValue(new Promise(() => {}));
    const controller = new AbortController();
    const pending = readPublicUrl(new URL('https://pds.example.com'), 1024, controller.signal);
    controller.abort(new Error('timeout'));
    await expect(pending).rejects.toThrow('timeout');
    expect(request).not.toHaveBeenCalled();
  });
  it('resolves and verifies the DID document and PDS endpoint', async () => {
    upstream(JSON.stringify({ id: did, service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://pds.example.com' }] }));
    expect((await resolvePublicPds(did, AbortSignal.timeout(1000))).origin).toBe('https://pds.example.com');
  });
  it('rejects a mismatched DID document', async () => {
    upstream(JSON.stringify({ id: 'did:plc:other' }));
    await expect(resolvePublicPds(did, AbortSignal.timeout(1000))).rejects.toThrow('mismatch');
  });
  it('rejects unsafe PDS URLs from DID documents', async () => {
    upstream(JSON.stringify({ id: did, service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://127.0.0.1' }] }));
    await expect(resolvePublicPds(did, AbortSignal.timeout(1000))).rejects.toThrow('Unsafe');
  });
});
