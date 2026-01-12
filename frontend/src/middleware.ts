import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const { pathname, searchParams } = request.nextUrl;

    // 静的ファイルなどは即時復帰
    if (pathname.includes('.')) {
        return NextResponse.next();
    }

    // lang がない場合のみリダイレクト
    if (!searchParams.has('lang')) {
        const url = request.nextUrl.clone();
        url.searchParams.set('lang', 'ja');
        return NextResponse.redirect(url, { status: 307 });
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
