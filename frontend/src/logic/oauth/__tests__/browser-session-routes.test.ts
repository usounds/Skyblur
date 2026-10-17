import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ raw: undefined as string | undefined, grant: true }));
const did = 'did:plc:route-migration';
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => state.raw ? { value: state.raw } : undefined }) }));
vi.mock('../client', () => ({
  getOAuthClient: async () => ({
    callback: async () => { state.grant = true; return { session: { did: 'did:plc:route-migration' } }; },
    revoke: async () => { state.grant = false; },
  }),
  restoreSession: async () => {
    if (!state.grant) throw new Error('session was deleted');
    return { did: 'did:plc:route-migration' };
  },
  getSafeTokenInfo: async () => ({ aud: 'https://pds.example.com', scope: 'atproto' }),
  isDeletedSessionError: (error: Error) => error.message === 'session was deleted',
  isUnsafeOAuthResourceError: () => false,
}));
vi.mock('../origin', () => ({ getRequestOrigin: () => 'https://skyblur.uk' }));
vi.mock('@atcute/client', () => ({
  Client: class { async post() { return { ok: true, data: { stored: true }, headers: new Headers() }; } },
}));

describe('OAuth cookie migration through route handlers', () => {
  beforeEach(() => {
    vi.resetModules();
    state.raw = undefined; state.grant = true;
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('USE_AWS_REAL_DB', 'false');
    vi.stubEnv('OAUTH_STORE_TABLE_NAME', '');
    vi.stubEnv('DATA_ENCRYPTION_KEY', '');
    vi.stubEnv('SESSION_SECRET', 'route-test-secret');
    (globalThis as unknown as { skyblurOAuthMemoryStore?: Map<string, unknown> }).skyblurOAuthMemoryStore?.clear();
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it('replaces a legacy cookie during session restoration without another OAuth authorization', async () => {
    state.raw = `${did}.${createHmac('sha256', 'route-test-secret').update(did).digest('base64url')}`;
    const { GET } = await import('@/app/api/oauth/session/route');
    const response = await GET(new Request('https://skyblur.uk/api/oauth/session'));
    expect(await response.json()).toMatchObject({ authenticated: true, did });
    const cookie = response.cookies.get('__Host-oauth_did');
    expect(cookie?.value).toMatch(/^v1\./);
    expect(cookie).toMatchObject({ secure: true, httpOnly: true, sameSite: 'lax', path: '/' });
    state.raw = cookie!.value;
    const restored = await GET(new Request('https://skyblur.uk/api/oauth/session'));
    expect(await restored.json()).toMatchObject({ authenticated: true });
    expect(restored.cookies.get('__Host-oauth_did')).toBeUndefined();
  });

  it('enforces individual revocation on protected XRPC without signing out another device', async () => {
    const { issueBrowserSession } = await import('../browser-session');
    const first = await issueBrowserSession(did);
    const second = await issueBrowserSession(did);
    const { POST: xrpc } = await import('@/app/xrpc/[method]/route');
    const context = { params: Promise.resolve({ method: 'uk.skyblur.post.store' }) };
    const request = () => new Request('https://skyblur.uk/xrpc/uk.skyblur.post.store', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    });
    state.raw = first;
    expect((await xrpc(request(), context)).status).toBe(200);
    const { POST: localLogout } = await import('@/app/api/oauth/soft-logout/route');
    await localLogout(new Request('https://skyblur.uk/api/oauth/soft-logout', { method: 'POST' }));
    expect((await xrpc(request(), context)).status).toBe(401);
    state.raw = second;
    expect((await xrpc(request(), context)).status).toBe(200);
    expect(state.grant).toBe(true);
  });

  it('full logout prevents legacy-cookie revival after the next callback', async () => {
    const legacy = `${did}.${createHmac('sha256', 'route-test-secret').update(did).digest('base64url')}`;
    state.raw = legacy;
    const { POST } = await import('@/app/api/oauth/logout/route');
    await POST(new Request('https://skyblur.uk/api/oauth/logout', { method: 'POST' }));
    expect(state.grant).toBe(false);
    const { GET: callback } = await import('@/app/api/oauth/callback/route');
    const response = await callback(new Request('https://skyblur.uk/api/oauth/callback?code=test'));
    const fresh = response.cookies.get('__Host-oauth_did')?.value;
    expect(fresh).toMatch(/^v1\./);
    const { GET: session } = await import('@/app/api/oauth/session/route');
    expect(await (await session(new Request('https://skyblur.uk/api/oauth/session'))).json()).toEqual({ authenticated: false });
    state.raw = fresh;
    expect(await (await session(new Request('https://skyblur.uk/api/oauth/session'))).json()).toMatchObject({ authenticated: true });
  });

  it('does not issue a login cookie when persistent binding storage fails', async () => {
    const { DynamoOAuthStore } = await import('../dynamo-store');
    vi.spyOn(DynamoOAuthStore.prototype, 'set').mockRejectedValue(new Error('store unavailable'));
    const { GET } = await import('@/app/api/oauth/callback/route');
    const response = await GET(new Request('https://skyblur.uk/api/oauth/callback?code=test'));
    expect(response.cookies.get('__Host-oauth_did')).toBeUndefined();
    expect(response.headers.get('location')).toContain('loginError=callback_failed');
  });

  it('reports full logout failure when the durable revocation cannot be saved', async () => {
    const { issueBrowserSession, getBrowserSession } = await import('../browser-session');
    state.raw = await issueBrowserSession(did);
    const { DynamoOAuthStore } = await import('../dynamo-store');
    vi.spyOn(DynamoOAuthStore.prototype, 'setIfOwner').mockRejectedValue(new Error('store unavailable'));
    const { POST } = await import('@/app/api/oauth/logout/route');
    const response = await POST(new Request('https://skyblur.uk/api/oauth/logout', { method: 'POST' }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ success: false });
    expect(response.cookies.get('__Host-oauth_did')).toBeUndefined();
    expect(state.grant).toBe(true);
    expect((await getBrowserSession(state.raw))?.did).toBe(did);
  });
});
