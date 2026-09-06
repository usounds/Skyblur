import { expect, test } from './fixtures';

test.describe('Markdown for Agents (Content Negotiation)', () => {
  const routes = [
    { path: '/ja', expectedTitle: 'Skyblurへようこそ', expectedFrontmatter: 'title: "Skyblur' },
    { path: '/en', expectedTitle: 'Welcome to Skyblur', expectedFrontmatter: 'title: "Skyblur' },
    { path: '/ja/features', expectedTitle: '機能紹介・限定公開の仕組み', expectedFrontmatter: 'title: "機能紹介' },
    { path: '/en/features', expectedTitle: 'Features & Visibility Settings', expectedFrontmatter: 'title: "Features' },
    { path: '/ja/termofuse', expectedTitle: 'プライバシーポリシー', expectedFrontmatter: 'title: "利用規約' },
    { path: '/en/termofuse', expectedTitle: 'Terms of Use', expectedFrontmatter: 'title: "Terms of Use' },
  ];

  for (const { path, expectedTitle, expectedFrontmatter } of routes) {
    test(`returns Markdown when Accept is text/markdown for ${path}`, async ({ request }) => {
      const response = await request.get(path, {
        headers: {
          Accept: 'text/markdown',
        },
      });

      expect(response.status()).toBe(200);

      const contentType = response.headers()['content-type'] || '';
      expect(contentType).toContain('text/markdown');

      const vary = response.headers()['vary'] || '';
      expect(vary.toLowerCase()).toContain('accept');

      const contentSignal = response.headers()['content-signal'] || '';
      expect(contentSignal).toContain('ai-train=yes');

      const body = await response.text();
      expect(body).toContain('---');
      expect(body).toContain(expectedFrontmatter);
      expect(body).toContain(expectedTitle);
    });

    test(`returns standard HTML when requested by browser for ${path}`, async ({ page }) => {
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
      expect(response?.status()).toBe(200);

      const contentType = response?.headers()['content-type'] || '';
      expect(contentType).toContain('text/html');

      // Verify that DOM elements render
      const bodyText = await page.textContent('body');
      expect(bodyText).toBeTruthy();
    });
  }
});
