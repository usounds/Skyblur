import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 静的ファイルなどは即時復帰
    if (pathname.includes('.')) {
        return NextResponse.next();
    }

    // 1. クッキーから言語を取得
    const langCookie = request.cookies.get('lang')?.value;

    // 2. ブラウザの言語設定を取得
    const acceptLanguage = request.headers.get('accept-language');

    const response = NextResponse.next();

    // クッキーがない場合にセット（ただし、accept-languageがある場合のみ）
    if (!langCookie && acceptLanguage) {
        const browserLang = acceptLanguage.startsWith('en') ? 'en' : 'ja';
        response.cookies.set('lang', browserLang, {
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
