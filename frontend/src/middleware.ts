import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const { pathname, searchParams } = request.nextUrl;

    // 静的ファイルなどは即時復帰
    if (pathname.includes('.')) {
        return NextResponse.next();
    }

    // 1. クッキーから言語を取得
    const langCookie = request.cookies.get('lang')?.value;

    // 2. ブラウザの言語設定を取得
    const acceptLanguage = request.headers.get('accept-language');
    const browserLang = acceptLanguage?.startsWith('en') ? 'en' : 'ja';

    // 最終的な言語を決定
    const targetLang = langCookie || browserLang;

    const response = NextResponse.next();

    // クッキーがない場合にセット
    if (!langCookie) {
        response.cookies.set('lang', targetLang, {
            path: '/',
            maxAge: 60 * 60 * 24 * 365, // 1 year
            sameSite: 'lax',
        });
    }

    return response;
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
