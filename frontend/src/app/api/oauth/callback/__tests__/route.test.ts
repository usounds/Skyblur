import { beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ cookie: '', callback: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (name: string) => name === '__Host-oauth_callback' ? { value: mock.cookie } : undefined }) }));
vi.mock('@/logic/oauth/client', () => ({ getOAuthClient: async () => ({ callback: mock.callback }), restoreSession: vi.fn() }));
vi.mock('@/logic/oauth/browser-session', () => ({ getBrowserSession: async () => undefined, issueBrowserSession: async () => 'v1.synthetic-cookie' }));
vi.mock('@/logic/oauth/origin', () => ({ getRequestOrigin: () => 'https://skyblur.uk' }));
import { GET } from '../route';
beforeEach(() => { mock.callback.mockReset().mockResolvedValue({ session: { did: 'did:plc:synthetic' } }); });
it.each(['%', '%ZZ', '%E0%A4%A', 'https://skyblur.uk/console#%ZZ'])(
  'finishes login safely with malformed redirect cookie %s', async (cookie) => {
    mock.cookie = cookie;
    const response = await GET(new Request('https://skyblur.uk/api/oauth/callback?code=synthetic'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://skyblur.uk/console');
    expect(response.cookies.get('__Host-oauth_callback')?.maxAge).toBe(0);
    expect(response.cookies.get('__Host-oauth_did')?.value).toBe('v1.synthetic-cookie');
  },
);
it('still checks same-origin redirects and clears the cookie on OAuth failure', async () => {
  mock.cookie = encodeURIComponent('https://attacker.example.com');
  mock.callback.mockRejectedValue(new Error('invalid callback'));
  const response = await GET(new Request('https://skyblur.uk/api/oauth/callback?error=access_denied'));
  expect(response.headers.get('location')).toBe('https://skyblur.uk/console?loginError=rejected');
  expect(response.cookies.get('__Host-oauth_callback')?.maxAge).toBe(0);
});
it('preserves safe encoded legacy redirects', async () => {
  mock.cookie = encodeURIComponent('https://skyblur.uk/console?from=login');
  const response = await GET(new Request('https://skyblur.uk/api/oauth/callback?code=synthetic'));
  expect(response.headers.get('location')).toBe('https://skyblur.uk/console?from=login');
});
