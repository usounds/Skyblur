import { describe, expect, it } from 'vitest';
import { POST } from '../route';

describe('/api/locale route', () => {
  it('sets httpOnly and secure cookie for valid ja locale', async () => {
    const request = new Request('https://skyblur.uk/api/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'ja' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const cookie = response.cookies.get('lang');
    expect(cookie).toBeDefined();
    expect(cookie?.value).toBe('ja');
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.secure).toBe(true);
    expect(cookie?.sameSite).toBe('lax');
    expect(cookie?.maxAge).toBe(31536000);
  });

  it('sets httpOnly and secure cookie for valid en locale', async () => {
    const request = new Request('https://skyblur.uk/api/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'en' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const cookie = response.cookies.get('lang');
    expect(cookie?.value).toBe('en');
    expect(cookie?.httpOnly).toBe(true);
  });

  it('rejects invalid locale', async () => {
    const request = new Request('https://skyblur.uk/api/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'invalid-lang' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('handles malformed JSON body gracefully', async () => {
    const request = new Request('https://skyblur.uk/api/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid-json',
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
