// Read-through results are ephemeral; public requests must not grow durable mirrors.
export const PDS_CACHE_TTL_MS = 60_000;
export const PDS_CACHE_MAX_ENTRIES = 128;
export const PDS_CACHE_MAX_BYTES = 4 * 1024 * 1024;
const MAX_ENTRY_BYTES = 64 * 1024;
type CachedRecord = { value: unknown; cid?: string };

export class PdsReadCache {
  private entries = new Map<string, { json: string; bytes: number; expiresAt: number }>();
  private bytes = 0;
  private key(repo: string, rkey: string) { return JSON.stringify([repo, rkey]); }
  private remove(key: string) {
    const entry = this.entries.get(key);
    if (entry) this.bytes -= entry.bytes;
    this.entries.delete(key);
  }
  get(repo: string, rkey: string, now = Date.now()): CachedRecord | undefined {
    const key = this.key(repo, rkey);
    const entry = this.entries.get(key);
    if (!entry) return;
    if (entry.expiresAt <= now) { this.remove(key); return; }
    this.entries.delete(key); this.entries.set(key, entry);
    return JSON.parse(entry.json) as CachedRecord;
  }
  set(repo: string, rkey: string, record: CachedRecord, now = Date.now()) {
    const key = this.key(repo, rkey);
    const json = JSON.stringify(record);
    const bytes = new TextEncoder().encode(key + json).byteLength;
    if (bytes > MAX_ENTRY_BYTES) return;
    for (const [oldKey, entry] of this.entries) if (entry.expiresAt <= now) this.remove(oldKey);
    this.remove(key);
    while (this.entries.size >= PDS_CACHE_MAX_ENTRIES || this.bytes + bytes > PDS_CACHE_MAX_BYTES) {
      this.remove(this.entries.keys().next().value!);
    }
    this.entries.set(key, { json, bytes, expiresAt: now + PDS_CACHE_TTL_MS });
    this.bytes += bytes;
  }
  clear() { this.entries.clear(); this.bytes = 0; }
}
export const pdsReadCache = new PdsReadCache();
