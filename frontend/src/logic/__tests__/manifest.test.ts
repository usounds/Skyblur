import { describe, expect, it } from 'vitest';
import { GET as getEn } from '../../app/manifest.en.webmanifest/route';
import { GET as getJa } from '../../app/manifest.ja.webmanifest/route';
import { GET as getLegacy } from '../../app/manifest.webmanifest/route';

describe('Web App Manifest Routes', () => {
  it('returns valid JSON with manifest headers and HSTS for English', async () => {
    const res = await getEn();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/manifest+json');
    expect(res.headers.get('Strict-Transport-Security')).toBe('max-age=63072000; includeSubDomains; preload');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    const data = await res.json();
    expect(data.lang).toBe('en');
    expect(data.name).toBe('Skyblur');
    expect(data.shortcuts[0].url).toBe('/console/posts/new');
  });

  it('returns valid JSON with manifest headers and HSTS for Japanese', async () => {
    const res = await getJa();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/manifest+json');
    expect(res.headers.get('Strict-Transport-Security')).toBe('max-age=63072000; includeSubDomains; preload');
    const data = await res.json();
    expect(data.lang).toBe('ja');
    expect(data.name).toBe('Skyblur');
    expect(data.shortcuts[0].name).toBe('新規投稿');
  });

  it('returns valid JSON with manifest headers for legacy route', async () => {
    const res = await getLegacy();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/manifest+json');
    expect(res.headers.get('Strict-Transport-Security')).toBe('max-age=63072000; includeSubDomains; preload');
    const data = await res.json();
    expect(data.lang).toBe('en');
  });
});
