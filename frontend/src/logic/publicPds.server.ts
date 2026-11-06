import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { request } from 'node:https';
import { isDid } from '@atcute/lexicons/syntax';
import { isValidServerSideHandle } from './oauth/handle';
import { BodyLimitError } from './boundedBody';

const blocked = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 3],
] as const) blocked.addSubnet(address, prefix, 'ipv4');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
blocked.addSubnet('2001::', 23, 'ipv6');
blocked.addSubnet('2001:db8::', 32, 'ipv6');
blocked.addSubnet('2002::', 16, 'ipv6');

export function isPublicAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, 'ipv4');
  return family === 6 && globalV6.check(address, 'ipv6') && !blocked.check(address, 'ipv6');
}

function validateUrl(url: URL) {
  if (url.protocol !== 'https:' || url.username || url.password || url.port
    || !isValidServerSideHandle(url.hostname)) throw new Error('Unsafe PDS URL');
}

/** Resolve once, then pin the validated address for the actual TLS connection. */
export async function readPublicUrl(url: URL, maxBytes: number, signal: AbortSignal): Promise<Response> {
  validateUrl(url);
  signal.throwIfAborted();
  let onAbort: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
  const addresses = await Promise.race([lookup(url.hostname, { all: true }), aborted])
    .finally(() => signal.removeEventListener('abort', onAbort));
  signal.throwIfAborted();
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error('Unsafe PDS address');
  }
  const selected = addresses[0];
  return new Promise((resolve, reject) => {
    const req = request(url, {
      method: 'GET', agent: false, signal,
      headers: { accept: '*/*', 'accept-encoding': 'identity' },
      // Preserve hostname for Host/TLS, without a second DNS resolution.
      lookup: (_hostname, options, callback) => options.all
        ? callback(null, [selected])
        : callback(null, selected.address, selected.family),
    }, (res) => {
      const status = res.statusCode ?? 502;
      if (status >= 300 && status < 400) {
        res.destroy();
        reject(new Error('PDS redirect rejected'));
        return;
      }
      if (Number(res.headers['content-length']) > maxBytes
        || (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity')) {
        res.destroy();
        reject(new BodyLimitError());
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on('error', reject);
      res.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) {
          res.destroy(new BodyLimitError());
        } else chunks.push(chunk);
      });
      res.on('end', () => resolve(new Response([204, 205, 304].includes(status) ? null : Buffer.concat(chunks), {
        status,
        headers: { 'content-type': res.headers['content-type'] ?? 'application/octet-stream' },
      })));
    });
    req.on('error', reject);
    req.end();
  });
}

export async function resolvePublicPds(did: string, signal: AbortSignal) {
  if (!isDid(did)) throw new Error('Invalid DID');
  let documentUrl: URL;
  if (did.startsWith('did:plc:')) {
    if (!/^did:plc:[a-z2-7]{24}$/.test(did)) throw new Error('Invalid PLC DID');
    documentUrl = new URL(`https://plc.directory/${did}`);
  } else if (did.startsWith('did:web:')) {
    const parts = did.slice(8).split(':').map(decodeURIComponent);
    const host = parts.shift()!;
    if (!isValidServerSideHandle(host) || parts.some((part) => !/^[a-zA-Z0-9._-]+$/.test(part) || part === '.' || part === '..')) {
      throw new Error('Invalid web DID');
    }
    documentUrl = new URL(`https://${host}/${parts.length ? `${parts.join('/')}/did.json` : '.well-known/did.json'}`);
  } else throw new Error('Unsupported DID');
  const response = await readPublicUrl(documentUrl, 64 * 1024, signal);
  if (!response.ok) throw new Error('DID resolution failed');
  const document = await response.json() as { id?: string; service?: { id?: string; type?: string; serviceEndpoint?: unknown }[] };
  if (document.id !== did) throw new Error('DID document mismatch');
  const endpoint = document.service?.find((service) =>
    (service.id === '#atproto_pds' || service.id === `${did}#atproto_pds`)
    && service.type === 'AtprotoPersonalDataServer')?.serviceEndpoint;
  if (typeof endpoint !== 'string') throw new Error('PDS not found');
  const url = new URL(endpoint);
  validateUrl(url);
  if (url.pathname !== '/' || url.search || url.hash) throw new Error('Invalid PDS endpoint');
  return url;
}
