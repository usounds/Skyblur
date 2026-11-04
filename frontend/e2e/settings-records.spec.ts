import { expect, test } from './fixtures';
import { mockPds, useLoggedInOAuthMock } from './oauth-mock';

test('settings read records through the same origin under restrictive connect-src', async ({ page, context, baseURL }) => {
  await useLoggedInOAuthMock(page, context, baseURL);
  await page.addInitScript(() => {
    const applyPolicy = () => {
      if (!document.head) return false;
      const policy = document.createElement('meta');
      policy.httpEquiv = 'Content-Security-Policy';
      policy.content = "connect-src 'self'";
      document.head.prepend(policy);
      return true;
    };
    if (!applyPolicy()) {
      const observer = new MutationObserver(() => {
        if (document.head) {
          observer.disconnect();
          applyPolicy();
        }
      });
      observer.observe(document, { childList: true, subtree: true });
    }
  });
  const recordRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/xrpc/com.atproto.repo.getRecord') recordRequests.push(request.url());
  });
  await page.goto('/settings');
  await expect(page.locator('textarea').first()).toHaveValue('Existing E2E My Page description');
  await expect(page.locator('input[value="E2E Custom Feed"]')).toBeVisible();
  // React may remove the injected meta node; the browser retains its policy.
  await page.route(`${mockPds}/csp-probe`, (route) => route.fulfill({
    body: 'allowed without CSP', headers: { 'Access-Control-Allow-Origin': '*' },
  }));
  expect(await page.evaluate(async (url) => {
    try { await fetch(url); return false; } catch { return true; }
  }, `${mockPds}/csp-probe`)).toBe(true);
  expect(new Set(recordRequests.map((url) => new URL(url).searchParams.get('collection'))))
    .toEqual(new Set(['uk.skyblur.preference', 'app.bsky.feed.generator']));
  expect(recordRequests.every((url) => new URL(url).origin === new URL(baseURL!).origin)).toBe(true);
  await page.locator('textarea').first().fill('Updated preference');
  const write = page.waitForRequest('**/xrpc/com.atproto.repo.applyWrites');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await write).postDataJSON().writes[0].$type).toBe('com.atproto.repo.applyWrites#update');
  await expect(page).toHaveURL(/\/console$/);
});

test('settings read failure is visible and cannot become a create write', async ({ page, context, baseURL }) => {
  await useLoggedInOAuthMock(page, context, baseURL);
  await page.route('**/xrpc/com.atproto.repo.getRecord?**', async (route) => {
    await route.fulfill({ status: 500, json: { error: 'InternalServerError', message: 'Record lookup failed' } });
  });
  const writes: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/xrpc/com.atproto.repo.applyWrites')) writes.push(request.url());
  });
  await page.goto('/settings');
  await expect(page.getByText(/Error:.*Record lookup failed/)).toBeVisible();
  await page.getByLabel('Publish').first().check();
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  expect(writes).toEqual([]);
});

test('settings create only after RecordNotFound', async ({ page, context, baseURL }) => {
  await useLoggedInOAuthMock(page, context, baseURL, { noPreference: true, noCustomFeed: true });
  await page.goto('/settings');
  await page.getByLabel('Publish').first().check();
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
  const write = page.waitForRequest('**/xrpc/com.atproto.repo.applyWrites');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await write).postDataJSON().writes[0].$type).toBe('com.atproto.repo.applyWrites#create');
  await expect(page).toHaveURL(/\/console$/);
});

test('settings do not report success when applyWrites returns an error', async ({ page, context, baseURL }) => {
  await useLoggedInOAuthMock(page, context, baseURL, { applyWritesStatus: 500 });
  await page.goto('/settings');
  await expect(page.locator('textarea').first()).toHaveValue('Existing E2E My Page description');
  await page.locator('textarea').first().fill('Updated preference');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.text-red-500')).toContainText('Error:');
  await expect(page).toHaveURL(/\/settings$/);
});
