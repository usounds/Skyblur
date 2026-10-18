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
  // Check parser-inserted scripts in the original HTML. Next's development
  // runtime can append trusted scripts without a nonce under strict-dynamic.
  const initialScriptNonces = await page.evaluate((html) => {
    const document = new DOMParser().parseFromString(html, 'text/html');
    return Array.from(document.scripts, (script) => script.nonce);
  }, await response!.text());
  expect(initialScriptNonces.length).toBeGreaterThan(0);
  expect(initialScriptNonces.every((value) => value === nonce)).toBe(true);

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


test('Passport login can reach its IdP under the delivered CSP', async ({ page, context, baseURL }) => {
  await useLoggedInOAuthMock(page, context, baseURL, { authenticated: false });
  await page.addInitScript(() => {
    localStorage.setItem('login.agreed', 'true');
    const probe = { urls: [] as string[], completed: false, error: '' };
    Object.assign(window, { passportCspProbe: probe });
    // Exercise the SDK and real browser CSP without depending on an IdP account.
    Object.defineProperty(window, 'IdentityCredential', { configurable: true, value: class {} });
    Object.defineProperty(navigator, 'credentials', { configurable: true, value: { get: async (options: { identity: { providers: { configURL: string }[] } }) => {
      try {
        probe.urls.push(options.identity.providers[0].configURL);
        for (const url of new Set([...probe.urls, 'https://atpassport.net/fedcm/config.json', 'https://dev.atpassport.net/fedcm/config.json', 'https://preview.atpassport.net/fedcm/config.json'])) {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`IdP response: ${response.status}`);
        }
        probe.completed = true;
      } catch (error) { probe.error = String(error); }
      return null;
    } } });
  });
  for (const origin of ['https://atpassport.net', 'https://dev.atpassport.net', 'https://preview.atpassport.net']) {
    await page.route(`${origin}/fedcm/config.json`, (route) => route.fulfill({
      json: {}, headers: { 'Access-Control-Allow-Origin': '*' },
    }));
  }
  const response = await page.goto('/ja');
  const connectSources = response!.headers()['content-security-policy'].split('; ')
    .find((directive) => directive.startsWith('connect-src '))!.split(' ');
  expect(connectSources).toContain('https://atpassport.net');
  expect(connectSources).toContain('https://dev.atpassport.net');
  expect(connectSources).toContain('https://preview.atpassport.net');
  await page.getByTestId('home-start-button').click();
  await page.getByRole('button', { name: '@passportでログイン', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { passportCspProbe: { completed: boolean } }).passportCspProbe.completed)).toBe(true);
  const result = await page.evaluate(() => (window as unknown as { passportCspProbe: { urls: string[]; error: string } }).passportCspProbe);
  expect(result.urls).toHaveLength(1);
  expect(result.urls[0]).toMatch(/^https:\/\/(dev\.)?atpassport\.net\/fedcm\/config\.json$/);
  expect(result.error).toBe('');
  await expect(page).toHaveURL(/\/ja$/);
});
