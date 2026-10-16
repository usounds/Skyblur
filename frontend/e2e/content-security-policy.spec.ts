import { expect, test } from './fixtures';
import { useLoggedInOAuthMock } from './oauth-mock';

test('CSP covers GET and HEAD on the root redirect and localized HTML', async ({ request }) => {
  for (const method of ['get', 'head'] as const) {
    const root = await request[method]('/', { maxRedirects: 0 });
    expect(root.status()).toBe(308);
    expect(root.headers()['location']).toMatch(/\/ja$/);
    expect(root.headers()['content-security-policy']).toContain("frame-ancestors 'none'");

    const page = await request[method]('/en');
    expect(page.status()).toBe(200);
    expect(page.headers()['content-security-policy']).toContain("'nonce-");
  }

  const first = await request.get('/en');
  const second = await request.get('/en');
  expect(first.headers()['content-security-policy']).not.toBe(second.headers()['content-security-policy']);
});

test('legitimate scripts hydrate and interactive UI works under CSP', async ({ page, context, baseURL }) => {
  await useLoggedInOAuthMock(page, context, baseURL, { authenticated: false });
  await context.addCookies([{ name: 'lang', value: 'ja', url: baseURL! }]);
  await page.route('https://static.cloudflareinsights.com/**', (route) => route.fulfill({
    contentType: 'application/javascript', body: '',
  }));
  await page.addInitScript(() => {
    const violations: string[] = [];
    Object.assign(window, { cspViolations: violations });
    document.addEventListener('securitypolicyviolation', (event) => {
      violations.push(`${event.effectiveDirective}: ${event.blockedURI}`);
    });
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  const response = await page.goto('/ja');
  const nonce = response!.headers()['content-security-policy'].match(/'nonce-([^']+)'/)![1];
  expect(await page.locator('script').evaluateAll((scripts) => scripts.map((script) => script.nonce)))
    .toEqual(expect.arrayContaining([nonce]));
  expect(await page.locator('script:not([type="application/ld+json"])').evaluateAll(
    (scripts, expected) => scripts.every((script) => script.nonce === expected), nonce,
  )).toBe(true);

  const startButton = page.getByTestId('home-start-button');
  await expect(startButton).toHaveAttribute('data-hydrated', 'true');
  await startButton.click();
  const dialog = page.getByRole('dialog', { name: 'ログイン', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('combobox')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  const html = page.locator('html');
  const previousScheme = await html.getAttribute('data-mantine-color-scheme');
  await page.getByRole('button', { name: 'Toggle color scheme' }).click();
  await expect(html).not.toHaveAttribute('data-mantine-color-scheme', previousScheme!);
  await page.getByRole('button', { name: 'Toggle language' }).click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByRole('heading', { name: 'Welcome to Skyblur' })).toBeVisible();
  await page.getByRole('button', { name: 'Toggle language' }).click();
  await expect(page).toHaveURL(/\/ja$/);

  // Exercise client navigation as well as a fresh document with a new nonce.
  await page.locator('a[href="/ja/features"]').first().click();
  await expect(page).toHaveURL(/\/ja\/features$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations)).toEqual([]);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations)).toEqual([]);
  await page.goto('/ja/termofuse');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  expect(await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations)).toEqual([]);
  expect(errors).toEqual([]);
});

test('CSP blocks an injected inline script without a nonce', async ({ page }) => {
  await page.route('**/api/oauth/session', (route) => route.fulfill({ json: { authenticated: false } }));
  await page.route('https://static.cloudflareinsights.com/**', (route) => route.fulfill({
    contentType: 'application/javascript', body: '',
  }));
  await page.addInitScript(() => {
    Object.assign(window, { cspViolations: [] });
    document.addEventListener('securitypolicyviolation', (event) => {
      (window as unknown as { cspViolations: string[] }).cspViolations.push(event.effectiveDirective);
    });
  });
  // Simulate an XSS payload in the actual HTML, so it is parser-inserted rather
  // than inheriting trust from Playwright's privileged script evaluation.
  await page.route('**/en', async (route) => {
    const response = await route.fetch();
    const html = await response.text();
    await route.fulfill({ response, body: html.replace('</head>', '<script>window.cspInjectedScriptRan = true</script></head>') });
  });
  await page.goto('/en');
  await expect.poll(() => page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations))
    .toContain('script-src-elem');
  expect(await page.evaluate(() => 'cspInjectedScriptRan' in window)).toBe(false);
});
