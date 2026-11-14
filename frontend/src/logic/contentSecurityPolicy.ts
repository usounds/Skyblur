export function createContentSecurityPolicy(nonce: string, isDevelopment: boolean, isHttps = true) {
    return [
        "default-src 'self'",
        `script-src 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ''}`,
        `style-src 'self' ${isDevelopment ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
        // Mantine needs style attributes; style elements require a nonce in production.
        "style-src-attr 'unsafe-inline'",
        "img-src 'self' https: data: blob:",
        "font-src 'self'",
        // FedCM checks its IdP configuration URL against connect-src.
        `connect-src 'self' https://atpassport.net https://dev.atpassport.net https://preview.atpassport.net https://public.api.bsky.app https://constellation.microcosm.blue https://cloudflareinsights.com${isDevelopment ? ' https: ws: wss:' : ''}`,
        "worker-src 'self'",
        "media-src 'self' https: blob:",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'self'",
        "frame-src 'none'",
        "frame-ancestors 'none'",
        // Safari upgrades even localhost assets, breaking HTTP production previews.
        ...(!isDevelopment && isHttps ? ['upgrade-insecure-requests'] : []),
    ].join('; ');
}
