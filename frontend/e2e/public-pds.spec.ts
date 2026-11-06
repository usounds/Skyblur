import { expect, test } from './fixtures';
import { mockDid, useLoggedInOAuthMock } from './oauth-mock';

test('anonymous public profile reads preferences and posts through same-origin routes', async ({ page, context, baseURL }) => {
  await useLoggedInOAuthMock(page, context, baseURL);
  await context.clearCookies();
  await context.addCookies([{ name: 'lang', value: 'en', url: baseURL! }]);
  await page.route('**/api/oauth/session', route => route.fulfill({ json: { authenticated: false } }));
  const directReads: string[] = [];
  const proxyReads: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.hostname === 'plc.directory' || url.hostname === 'e2e-pds.skyblur.test') directReads.push(url.href);
    if (url.pathname.startsWith('/api/public-pds/')) proxyReads.push(url.href);
  });
  await page.goto(`/profile/${encodeURIComponent(mockDid)}`);
  await expect(page.getByText('Existing E2E My Page description')).toBeVisible();
  await expect(page.getByText('Visible E2E ○○○○○○ console post')).toBeVisible();
  expect(proxyReads.some(url => url.includes('com.atproto.repo.getRecord'))).toBe(true);
  expect(proxyReads.some(url => url.includes('com.atproto.repo.listRecords'))).toBe(true);
  expect(directReads).toEqual([]);
});

test('anonymous post details retain the My Page link without PDS browser requests', async ({ page, context, baseURL }) => {
  await useLoggedInOAuthMock(page, context, baseURL, { postDetailVariant: 'public' });
  await context.clearCookies();
  await context.addCookies([{ name: 'lang', value: 'en', url: baseURL! }]);
  await page.route('**/api/oauth/session', route => route.fulfill({ json: { authenticated: false } }));
  const directReads: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.hostname === 'plc.directory' || url.hostname === 'e2e-pds.skyblur.test') directReads.push(url.href);
  });
  await page.goto(`/post/${encodeURIComponent(mockDid)}/e2epost`);
  await expect(page.getByRole('button', { name: 'Go to My Page' })).toBeVisible();
  expect(directReads).toEqual([]);
});

test('settings displays existing feed images through the same origin and preserves the blob on save', async ({ page, context, baseURL }) => {
  await useLoggedInOAuthMock(page, context, baseURL, { customFeedAvatar: true });
  await page.goto('/settings');
  const image = page.getByAltText('Feed Avatar Image');
  await expect(image).toBeVisible();
  const imageUrl = new URL((await image.getAttribute('src'))!, baseURL);
  expect(imageUrl.origin).toBe(new URL(baseURL!).origin);
  expect(imageUrl.pathname).toBe('/api/public-pds/xrpc/com.atproto.sync.getBlob');
  await page.locator('input[value="E2E Custom Feed"]').fill('Updated feed');
  const write = page.waitForRequest('**/xrpc/com.atproto.repo.applyWrites');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const feed = (await write).postDataJSON().writes.find((item: { collection: string }) => item.collection === 'app.bsky.feed.generator');
  expect(feed.value.avatar.ref.$link).toBe('bafy-e2e-existing-avatar');
  await expect(page).toHaveURL(/\/console$/);
});
