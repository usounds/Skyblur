import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '../../proxy';
import { createContentSecurityPolicy } from '../contentSecurityPolicy';

describe('Content Security Policy', () => {
    it('blocks injected scripts and embeds without disabling federation or inline styles', () => {
        const policy = createContentSecurityPolicy('test-nonce', false);
        expect(policy).toContain("script-src 'nonce-test-nonce' 'strict-dynamic'");
        expect(policy).not.toContain("'unsafe-eval'");
        expect(policy.split('; ').find((part) => part.startsWith('script-src'))).not.toContain("'unsafe-inline'");
        expect(policy).toContain("object-src 'none'");
        expect(policy).toContain("base-uri 'none'");
        expect(policy).toContain("frame-ancestors 'none'");
        expect(policy).toContain("connect-src 'self' https://atpassport.net https://dev.atpassport.net https://preview.atpassport.net https://public.api.bsky.app https://constellation.microcosm.blue https://cloudflareinsights.com https://*.bsky.app https://*.bsky.social");
        expect(policy).toContain("style-src 'self' 'unsafe-inline'");
        expect(policy).toContain('upgrade-insecure-requests');
    });

    it('allows production, development and preview Passport IdPs in production without allowing arbitrary HTTPS connections', () => {
        const sources = createContentSecurityPolicy('nonce', false).split('; ')
            .find((directive) => directive.startsWith('connect-src '))!.split(' ').slice(1);
        expect(sources).toContain('https://atpassport.net');
        expect(sources).toContain('https://dev.atpassport.net');
        expect(sources).toContain('https://preview.atpassport.net');
        expect(sources).not.toContain('https:');
        expect(sources).not.toContain('*');
    });

    it('allows development debugging and hot reload without upgrading local HTTP', () => {
        const policy = createContentSecurityPolicy('test-nonce', true);
        expect(policy).toContain("'unsafe-eval'");
        expect(policy).toContain('ws: wss:');
        expect(policy).not.toContain('upgrade-insecure-requests');
    });

    it('keeps production script protections on HTTP previews without upgrading their assets', () => {
        const policy = createContentSecurityPolicy('test-nonce', false, false);
        expect(policy).not.toContain('upgrade-insecure-requests');
        expect(policy).not.toContain("'unsafe-eval'");
        expect(policy).toContain("'nonce-test-nonce'");
    });

    it('covers the root redirect, preserves its destination and query, and sets HSTS/security headers', () => {
        const response = proxy(new NextRequest('https://skyblur.uk/?source=test'));
        expect(response.status).toBe(308);
        expect(response.headers.get('location')).toBe('https://skyblur.uk/ja?source=test');
        expect(response.headers.get('Content-Security-Policy')).toContain("object-src 'none'");
        expect(response.headers.get('Strict-Transport-Security')).toBe('max-age=63072000; includeSubDomains; preload');
        expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
        expect(response.headers.get('X-Frame-Options')).toBe('DENY');
        expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    });

    it.each(['/en', '/ja', '/profile/user.example', '/post/did:web:user.example/key'])(
        'forwards a fresh trusted nonce for rendering %s', (path) => {
            const request = () => new NextRequest(`https://skyblur.uk${path}`, {
                headers: { 'x-nonce': 'attacker-value', 'Content-Security-Policy': "script-src 'unsafe-inline'" },
            });
            const first = proxy(request());
            const second = proxy(request());
            const nonce = first.headers.get('x-middleware-request-x-nonce');
            const policy = first.headers.get('Content-Security-Policy');
            expect(nonce).toBeTruthy();
            expect(nonce).not.toBe('attacker-value');
            expect(nonce).not.toBe(second.headers.get('x-middleware-request-x-nonce'));
            expect(policy).toContain(`'nonce-${nonce}'`);
            expect(first.headers.get('x-middleware-request-content-security-policy')).toBe(policy);
        },
    );

    it('keeps the policy on negotiated Markdown rewrites', () => {
        const response = proxy(new NextRequest('https://skyblur.uk/en', {
            headers: { accept: 'text/markdown' },
        }));
        expect(response.headers.get('x-middleware-rewrite')).toContain('/api/agent-markdown?path=%2Fen');
        expect(response.headers.get('Content-Security-Policy')).toBe(
            response.headers.get('x-middleware-request-content-security-policy'),
        );
    });

    it('sets the lang cookie with secure=true and httpOnly=true when visiting via HTTPS', () => {
        const response = proxy(new NextRequest('https://skyblur.uk/en'));
        const cookie = response.cookies.get('lang');
        expect(cookie).toBeDefined();
        expect(cookie?.value).toBe('en');
        expect(cookie?.secure).toBe(true);
        expect(cookie?.httpOnly).toBe(true);
        expect(cookie?.sameSite).toBe('lax');
    });
});

