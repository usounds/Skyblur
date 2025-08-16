import { setCookie, getCookie } from 'hono/cookie'

// 値に署名を付けてクッキーをセット
export async function setSignedCookie(
    c: any,
    name: string,
    value: string,
    secret: string,
) {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: { name: 'SHA-256' } },
        false,
        ['sign']
    )
    const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(value))
    const signature = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)))
    function getRootDomain(host: string): string {
        const parts = host.split('.');
        if (parts.length >= 2) {
            return parts.slice(-2).join('.'); // 最後の2つを結合
        }
        return host;
    }


    const cookieOptions = {
        httpOnly: true,
        secure: true,
        path: '/',
        sameSite: 'None' as const,
        domain: getRootDomain(c.env.APPVIEW_HOST), // ここにドット
    }

    setCookie(c, name, `${value}.${signature}` as string, cookieOptions)
}

// クッキーから値を取り出して署名を検証
export async function getSignedCookie(
    c: any,
    name: string,
    secret: string
): Promise<string | null> {
    const raw = getCookie(c, name)
    if (!raw) return null

    const [value, signature] = raw.split('.')
    if (!value || !signature) return null

    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: { name: 'SHA-256' } },
        false,
        ['sign']
    )
    const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(value))
    const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)))

    return signature === expected ? value : null
}
