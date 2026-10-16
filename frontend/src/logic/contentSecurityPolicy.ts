export function createContentSecurityPolicy(nonce: string, isDevelopment: boolean, isHttps = true) {
    return [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://static.cloudflareinsights.com${isDevelopment ? " 'unsafe-eval'" : ''}`,
        // Mantine and existing components use inline style attributes.
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' https: data: blob:",
        "font-src 'self'",
        // Federated did:web / PDS hosts are discovered at runtime, not a fixed allowlist.
        `connect-src 'self' https:${isDevelopment ? ' ws: wss:' : ''}`,
        "worker-src 'self'",
        "media-src 'self' https: blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-src 'none'",
        "frame-ancestors 'none'",
        // Safari upgrades even localhost assets, breaking HTTP production previews.
        ...(!isDevelopment && isHttps ? ['upgrade-insecure-requests'] : []),
    ].join('; ');
}
