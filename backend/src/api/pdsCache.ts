// Bump this code-level generation to invalidate only PDS read-through snapshots.
// Jetstream projections are not affected and no environment variable is required.
export const PDS_CACHE_GENERATION = 'v2';

export function pdsCacheEventId(repo: string, rkey: string, cid: string | undefined, timeUs: number): string {
  return `pds:${PDS_CACHE_GENERATION}:${repo}:${rkey}:${cid ?? timeUs}`;
}
