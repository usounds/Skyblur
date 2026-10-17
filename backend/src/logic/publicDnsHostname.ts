// Syntactic host validation, not a DNS pinning check. Network isolation is
// provided by the Cloudflare Workers global fetch boundary (public Internet),
// never by a private service/VPC binding or a preflight DNS lookup.
export function isPublicDnsHostname(hostname: string): boolean {
    const host = hostname.toLowerCase().replace(/\.$/, '');
    return host.length <= 253 && host.includes('.')
        && !/^\d+\.\d+\.\d+\.\d+$/.test(host)
        && host.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
        && host !== 'localhost.localdomain'
        && !/\.(?:localhost|localdomain|local|internal|home|lan|invalid|test)$/.test(host)
        && !host.endsWith('.home.arpa');
}
