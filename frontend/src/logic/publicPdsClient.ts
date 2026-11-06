import { Client } from '@atcute/client';

/** Anonymous, same-origin reads of public PDS data. */
export const publicPdsClient = new Client({
  handler: (pathname, init) => fetch(`/api/public-pds${pathname}`, { ...init, credentials: 'omit' }),
});

export function getPublicBlobUrl(did: string, cid: string) {
  const params = new URLSearchParams({ did, cid });
  return `/api/public-pds/xrpc/com.atproto.sync.getBlob?${params}`;
}
