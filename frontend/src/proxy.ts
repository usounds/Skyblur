import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { normalizeLocale, resolveLocale } from '@/logic/locale';

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 静的ファイルなどは即時復帰
    if (pathname.includes('.')) {
        return NextResponse.next();
    }

    // x-nextjs-router-state ヘッダーが大きすぎる場合は削除（エラー回避）
    const headers = new Headers(request.headers);
    const routerState = headers.get('x-nextjs-router-state');
    if (routerState && routerState.length > 5120) {
        console.warn(`[Proxy] usage of x-nextjs-router-state detected with size ${routerState.length}. Stripping header.`);
        headers.delete('x-nextjs-router-state');
        return NextResponse.next({
            request: {
                headers: headers,
            },
        });
    }

    // 1. クッキーから言語を取得
    const langCookie = request.cookies.get('lang')?.value;

    // 2. ブラウザの言語設定を取得
    const acceptLanguage = request.headers.get('accept-language');

    const response = NextResponse.next();

    // クッキーがない、または不正な場合は、SSR と同じ判定で言語を保存する
    if (!normalizeLocale(langCookie)) {
        response.cookies.set('lang', resolveLocale(langCookie, acceptLanguage), {
            path: '/',
            maxAge: 60 * 60 * 24 * 365, // 1 year
            sameSite: 'lax',
        });
    }

    return response;
}

export const config = {
    matcher: ['/((?!api|xrpc|_next/static|_next/image|favicon.ico).*)'],
};
