export function createContentSecurityPolicy(nonce: string, isDevelopment: boolean, isHttps = true) {
    return [
        "default-src 'self'",
        `script-src 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ''}`,
        // Mantine and existing components use inline style attributes.
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' https: data: blob:",
        "font-src 'self'",
        `connect-src 'self' https://public.api.bsky.app https://constellation.microcosm.blue https://cloudflareinsights.com https://*.bsky.app https://*.bsky.social${isDevelopment ? ' https: ws: wss:' : ''}`,
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
