import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { normalizeLocale, resolveLocale } from '@/logic/locale';
import { createContentSecurityPolicy } from '@/logic/contentSecurityPolicy';

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const accept = request.headers.get('accept') || '';
    const requestHeaders = new Headers(request.headers);
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
    const csp = createContentSecurityPolicy(nonce, process.env.NODE_ENV === 'development', request.nextUrl.protocol === 'https:');
    // Next.js reads the request CSP to nonce its own runtime and hydration scripts.
    // Overwrite incoming values so clients cannot choose the trusted nonce or policy.
    requestHeaders.set('x-nonce', nonce);
    requestHeaders.set('Content-Security-Policy', csp);

    const withCsp = (response: NextResponse) => {
        response.headers.set('Content-Security-Policy', csp);
        if (request.nextUrl.protocol === 'https:' || process.env.NODE_ENV !== 'development') {
            response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
        }
        response.headers.set('X-Content-Type-Options', 'nosniff');
        response.headers.set('X-Frame-Options', 'DENY');
        response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
        response.headers.delete('x-powered-by');
        return response;
    };

    // Content negotiation for AI agents (Markdown for Agents)
    if (accept.includes('text/markdown')) {
        const cleanPath = pathname.replace(/\/$/, '') || '/';
        const supportedPaths = new Set([
            '/',
            '/ja',
            '/en',
            '/features',
            '/ja/features',
            '/en/features',
            '/termofuse',
            '/ja/termofuse',
            '/en/termofuse',
        ]);
        if (supportedPaths.has(cleanPath)) {
            const url = request.nextUrl.clone();
            url.pathname = '/api/agent-markdown';
            url.searchParams.set('path', cleanPath);
            requestHeaders.set('x-markdown-path', cleanPath);
            return withCsp(NextResponse.rewrite(url, {
                request: {
                    headers: requestHeaders,
                },
            }));
        }
    }

    // Public marketing pages have one indexable URL per language.  Keeping the
    // unprefixed home page locale-adaptive created a second Japanese page at
    // `/`, competing with `/ja` for Google's canonical selection.
    if (pathname === '/') {
        const localizedUrl = request.nextUrl.clone();
        localizedUrl.pathname = '/ja';
        return withCsp(NextResponse.redirect(localizedUrl, 308));
    }

    // 静的ファイルなどは即時復帰
    if (pathname.includes('.')) {
        return withCsp(NextResponse.next({ request: { headers: requestHeaders } }));
    }

    // x-nextjs-router-state ヘッダーが大きすぎる場合は削除（エラー回避）
    const headers = requestHeaders;
    const routerState = headers.get('x-nextjs-router-state');
    if (routerState && routerState.length > 5120) {
        console.warn(`[Proxy] usage of x-nextjs-router-state detected with size ${routerState.length}. Stripping header.`);
        headers.delete('x-nextjs-router-state');
    }

    // 1. クッキーから言語を取得
    const langCookie = request.cookies.get('lang')?.value;

    // 2. ブラウザの言語設定を取得
    const acceptLanguage = request.headers.get('accept-language');
    const pathLocale = normalizeLocale(pathname.split('/').filter(Boolean)[0]);
    const resolvedLocale = pathLocale ?? resolveLocale(langCookie, acceptLanguage);
    headers.set('x-skyblur-locale', resolvedLocale);

    const response = NextResponse.next({
        request: {
            headers: headers,
        },
    });

    // クッキーがない、または不正な場合は、SSR と同じ判定で言語を保存する
    // locale 付きURLでは、そのURLの言語を次回のUI表示にも反映する
    if (!normalizeLocale(langCookie) || (pathLocale && langCookie !== pathLocale)) {
        response.cookies.set('lang', resolvedLocale, {
            path: '/',
            maxAge: 60 * 60 * 24 * 365, // 1 year
            sameSite: 'lax',
            httpOnly: true,
            secure: request.nextUrl.protocol === 'https:' || process.env.NODE_ENV !== 'development',
        });
    }

    return withCsp(response);
}

export const config = {
    matcher: ['/((?!api|xrpc|_next/static|_next/image|favicon.ico).*)'],
};
