import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Use the real store's local memory implementation, including its conditional
// deletes and lock behavior. No network, fake grant state is explicit per test.
describe('browser session migration and revocation', () => {
  const did = 'did:plc:session-migration-test';
  const legacy = () => `${did}.${createHmac('sha256', 'test-session-secret').update(did).digest('base64url')}`;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('USE_AWS_REAL_DB', 'false');
    vi.stubEnv('OAUTH_STORE_TABLE_NAME', '');
    vi.stubEnv('DATA_ENCRYPTION_KEY', '');
    vi.stubEnv('SESSION_SECRET', 'test-session-secret');
    (globalThis as unknown as { skyblurOAuthMemoryStore?: Map<string, unknown> }).skyblurOAuthMemoryStore?.clear();
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it('migrates a live legacy session without reauthentication and keeps other legacy browsers working', async () => {
    const { getBrowserSession } = await import('../browser-session');
    const restore = vi.fn().mockResolvedValue({ did });
    const first = await getBrowserSession(legacy(), restore, true);
    const second = await getBrowserSession(legacy(), restore, true);
    expect(first?.replacementCookie).toMatch(/^v1\./);
    expect(first?.sessionId).not.toBe(second?.sessionId);
    expect((await getBrowserSession(first?.replacementCookie))?.did).toBe(did);
    expect((await getBrowserSession(legacy(), restore))?.did).toBe(did);
  });

  it('local logout revokes only that browser and cannot affect a later login', async () => {
    const { issueBrowserSession, getBrowserSession, revokeBrowserSession } = await import('../browser-session');
    const first = await issueBrowserSession(did);
    const second = await issueBrowserSession(did);
    await revokeBrowserSession(first);
    expect(await getBrowserSession(first)).toBeNull();
    expect((await getBrowserSession(second))?.did).toBe(did);
    const third = await issueBrowserSession(did);
    const revoke = vi.fn();
    await revokeBrowserSession(first, revoke);
    expect(revoke).not.toHaveBeenCalled();
    expect((await getBrowserSession(third))?.did).toBe(did);
  });

  it('full logout permanently rejects old SIDs and legacy cookies after a new OAuth login', async () => {
    const { issueBrowserSession, getBrowserSession, revokeBrowserSession } = await import('../browser-session');
    const restore = vi.fn().mockResolvedValue({ did });
    const first = (await getBrowserSession(legacy(), restore, true))!.replacementCookie!;
    const second = await issueBrowserSession(did);
    const revoke = vi.fn().mockResolvedValue(undefined);
    await revokeBrowserSession(first, revoke);
    expect(revoke).toHaveBeenCalledWith(did);
    const third = await issueBrowserSession(did);
    expect(await getBrowserSession(first)).toBeNull();
    expect(await getBrowserSession(second)).toBeNull();
    expect(await getBrowserSession(legacy(), restore, true)).toBeNull();
    expect((await getBrowserSession(third))?.did).toBe(did);
  });

  it('does not migrate a deleted OAuth session or invalid cookie', async () => {
    const { getBrowserSession } = await import('../browser-session');
    const restore = vi.fn().mockRejectedValue(new Error('session was deleted'));
    expect(await getBrowserSession(legacy(), restore, true)).toBeNull();
    expect(await getBrowserSession(`${legacy()}tampered`, restore, true)).toBeNull();
    expect(await getBrowserSession('%invalid', restore, true)).toBeNull();
  });

  it('uses a fixed persisted migration deadline and checks expiry even before Dynamo TTL deletion', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-17T00:00:00Z'));
    const { SESSION_TTL_SECONDS } = await import('../constants');
    const { getBrowserSession, issueBrowserSession } = await import('../browser-session');
    const restore = vi.fn().mockResolvedValue({ did });
    const cookie = await issueBrowserSession(did);
    await getBrowserSession(legacy(), restore, true);
    vi.setSystemTime(Date.now() + SESSION_TTL_SECONDS * 1000);
    expect(await getBrowserSession(cookie)).toBeNull();
    expect(await getBrowserSession(legacy(), restore, true)).toBeNull();
    await issueBrowserSession(did);
    expect(await getBrowserSession(legacy(), restore, true)).toBeNull();
  });

  it('retains the revocation generation when upstream OAuth revoke fails', async () => {
    const { issueBrowserSession, getBrowserSession, revokeBrowserSession } = await import('../browser-session');
    const cookie = await issueBrowserSession(did);
    await expect(revokeBrowserSession(cookie, async () => { throw new Error('upstream failure'); })).rejects.toThrow('upstream failure');
    expect(await getBrowserSession(cookie)).toBeNull();
    await issueBrowserSession(did);
    expect(await getBrowserSession(legacy(), async () => ({ did }), true)).toBeNull();
  });

  it('issues no cookie when checking the live grant fails', async () => {
    const { issueBrowserSession } = await import('../browser-session');
    await expect(issueBrowserSession(did, async () => { throw new Error('missing grant'); })).rejects.toThrow('missing grant');
  });

  it('records explicit full logout for a legacy cookie even if its OAuth grant is already gone', async () => {
    const { issueBrowserSession, getBrowserSession, revokeBrowserSession } = await import('../browser-session');
    const revoke = vi.fn();
    await revokeBrowserSession(legacy(), revoke, async () => { throw new Error('session was deleted'); });
    expect(revoke).not.toHaveBeenCalled();
    const fresh = await issueBrowserSession(did);
    expect((await getBrowserSession(fresh))?.did).toBe(did);
    expect(await getBrowserSession(legacy(), async () => ({ did }), true)).toBeNull();
  });

  it('serializes a concurrent login behind full logout', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { issueBrowserSession, getBrowserSession, revokeBrowserSession } = await import('../browser-session');
    const old = await issueBrowserSession(did);
    let release!: () => void;
    let entered!: () => void;
    const ready = new Promise<void>((resolve) => { entered = resolve; });
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    const logout = revokeBrowserSession(old, async () => { entered(); await blocked; });
    await ready;
    let issued = false;
    const login = issueBrowserSession(did).then((cookie) => { issued = true; return cookie; });
    await vi.advanceTimersByTimeAsync(1000);
    expect(issued).toBe(false);
    release();
    await logout;
    await vi.advanceTimersByTimeAsync(1000);
    const fresh = await login;
    expect(await getBrowserSession(old)).toBeNull();
    expect((await getBrowserSession(fresh))?.did).toBe(did);
  });
});
