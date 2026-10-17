import { NextResponse } from 'next/server';
import { normalizeLocale } from '@/logic/locale';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const locale = normalizeLocale(body?.locale);
    if (!locale) {
      return NextResponse.json({ error: 'Invalid locale' }, { status: 400 });
    }

    const response = NextResponse.json({ success: true });
    const isHttps = new URL(request.url).protocol === 'https:' || process.env.NODE_ENV === 'production';
    response.cookies.set('lang', locale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      httpOnly: true,
      secure: isHttps,
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
