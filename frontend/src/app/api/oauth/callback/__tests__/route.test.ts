import { beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ cookie: '', stateCookie: 'valid-state-token', callback: vi.fn() }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      if (name === '__Host-oauth_callback') return { value: mock.cookie };
      if (name === '__Host-oauth_state') return mock.stateCookie ? { value: mock.stateCookie } : undefined;
      return undefined;
    },
  }),
}));
vi.mock('@/logic/oauth/client', () => ({ getOAuthClient: async () => ({ callback: mock.callback }), restoreSession: vi.fn() }));
vi.mock('@/logic/oauth/browser-session', () => ({ getBrowserSession: async () => undefined, issueBrowserSession: async () => 'v1.synthetic-cookie' }));
vi.mock('@/logic/oauth/origin', () => ({ getRequestOrigin: () => 'https://skyblur.uk' }));
import { GET } from '../route';

beforeEach(() => {
  mock.cookie = '';
  mock.stateCookie = 'valid-state-token';
  mock.callback.mockReset().mockResolvedValue({ session: { did: 'did:plc:synthetic' } });
});

it.each(['%', '%ZZ', '%E0%A4%A', 'https://skyblur.uk/console#%ZZ'])(
  'finishes login safely with malformed redirect cookie %s when state matches', async (cookie) => {
    mock.cookie = cookie;
    const response = await GET(new Request('https://skyblur.uk/api/oauth/callback?code=synthetic&state=valid-state-token'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://skyblur.uk/console');
    expect(response.cookies.get('__Host-oauth_callback')?.maxAge).toBe(0);
    expect(response.cookies.get('__Host-oauth_state')?.maxAge).toBe(0);
    expect(response.cookies.get('__Host-oauth_did')?.value).toBe('v1.synthetic-cookie');
  },
);

it('rejects callback when browser-bound state cookie is missing (Login CSRF blocked)', async () => {
  mock.stateCookie = '';
  const response = await GET(new Request('https://skyblur.uk/api/oauth/callback?code=synthetic&state=attacker-state'));
  expect(response.status).toBe(307);
  expect(response.headers.get('location')).toBe('https://skyblur.uk/console?loginError=state_mismatch');
  expect(response.cookies.get('__Host-oauth_state')?.maxAge).toBe(0);
  expect(mock.callback).not.toHaveBeenCalled();
});

it('rejects callback when state parameter does not match browser-bound cookie (Login CSRF blocked)', async () => {
  mock.stateCookie = 'browser-state-a';
  const response = await GET(new Request('https://skyblur.uk/api/oauth/callback?code=synthetic&state=attacker-state-b'));
  expect(response.status).toBe(307);
  expect(response.headers.get('location')).toBe('https://skyblur.uk/console?loginError=state_mismatch');
  expect(response.cookies.get('__Host-oauth_state')?.maxAge).toBe(0);
  expect(mock.callback).not.toHaveBeenCalled();
});

it('still checks same-origin redirects and clears the cookies on OAuth failure', async () => {
  mock.cookie = encodeURIComponent('https://attacker.example.com');
  mock.callback.mockRejectedValue(new Error('invalid callback'));
  const response = await GET(new Request('https://skyblur.uk/api/oauth/callback?error=access_denied&state=valid-state-token'));
  expect(response.headers.get('location')).toBe('https://skyblur.uk/console?loginError=rejected');
  expect(response.cookies.get('__Host-oauth_callback')?.maxAge).toBe(0);
  expect(response.cookies.get('__Host-oauth_state')?.maxAge).toBe(0);
});

it('preserves safe encoded legacy redirects when state matches', async () => {
  mock.cookie = encodeURIComponent('https://skyblur.uk/console?from=login');
  const response = await GET(new Request('https://skyblur.uk/api/oauth/callback?code=synthetic&state=valid-state-token'));
  expect(response.headers.get('location')).toBe('https://skyblur.uk/console?from=login');
  expect(response.cookies.get('__Host-oauth_state')?.maxAge).toBe(0);
});
