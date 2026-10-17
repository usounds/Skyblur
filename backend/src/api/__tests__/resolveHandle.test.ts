import { afterEach, describe, it, expect, vi } from 'vitest';
import { handle } from '../resolveHandle';

const validDid = 'did:plc:abcdefghijklmnopqrstuvwx';
function context(value?: string) {
    const url = new URL('https://api.example.com/resolve');
    if (value !== undefined) url.searchParams.set('handle', value);
    return { req: { url: url.href }, json: vi.fn() };
}

describe('resolveHandle API', () => {
    afterEach(() => { vi.unstubAllGlobals(); });

    it.each(['user.bsky.social', 'UsEr.BsKy.SoCiAl', 'xn--bcher-kva.de'])(
        'resolves a public handle without following redirects: %s', async (value) => {
            const c = context(value);
            const fetchMock = vi.fn().mockResolvedValue(new Response(`${validDid}\n`));
            vi.stubGlobal('fetch', fetchMock);
            await handle(c as never);
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock).toHaveBeenCalledWith(
                new URL(`https://${value.toLowerCase()}/.well-known/atproto-did`),
                { redirect: 'manual', signal: expect.any(AbortSignal) },
            );
            expect(c.json).toHaveBeenCalledWith({ did: validDid });
        },
    );

    it('accepts supported did:web identifiers', async () => {
        const c = context('user.example.com');
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('did:web:user.example.com')));
        await handle(c as never);
        expect(c.json).toHaveBeenCalledWith({ did: 'did:web:user.example.com' });
    });

    it('returns an error if handle is missing', async () => {
        const c = context();
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        await handle(c as never);
        expect(c.json).toHaveBeenCalledWith({ error: 'Missing handle' }, 400);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([
        '127.0.0.1', '127.1', '2130706433', '0x7f000001', '[::1]',
        '[::ffff:127.0.0.1]', 'localhost', 'localhost.', 'localhost.localdomain',
        'app.internal', 'app.local', 'app.home.arpa', 'user.com:8443',
        'user@evil.com', 'user:pass@evil.com', 'user.com/path', 'user.com\\path',
        'user.com?query=1', 'user.com#fragment', 'user.com.', ' user.com',
        'user.com\r\n', 'https://user.com', '%31%32%37.0.0.1',
    ])('rejects unsafe input before any network request: %s', async (value) => {
        const c = context(value);
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        await handle(c as never);
        expect(c.json).toHaveBeenCalledWith({ error: 'Invalid handle' }, 400);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([301, 302, 307, 308])('rejects a %s redirect to an internal service', async (status) => {
        const c = context('user.example.com');
        const fetchMock = vi.fn().mockResolvedValue(new Response(null, {
            status, headers: { location: 'https://127.0.0.1/private' },
        }));
        vi.stubGlobal('fetch', fetchMock);
        await handle(c as never);
        expect(c.json).toHaveBeenCalledWith({ error: 'Domain is unreachable' }, 502);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][1].redirect).toBe('manual');
    });

    it.each(['not-a-did', 'did:plc:', 'did:plc:abc<script>', `${validDid}\nprivate-data`, 'did:key:z6abc', 'x'.repeat(2049)])(
        'rejects invalid or oversized DID responses', async (body) => {
            const c = context('user.example.com');
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));
            await handle(c as never);
            expect(c.json).toHaveBeenCalledWith({ error: 'Invalid DID' }, 400);
        },
    );

    it('returns 502 if domain is unreachable', async () => {
        const c = context('down.com');
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
        await handle(c as never);
        expect(c.json).toHaveBeenCalledWith({ error: 'Domain is unreachable' }, 502);
    });

    it.each([new Error('Network error'), new DOMException('Request timed out', 'TimeoutError')])(
        'returns an error rather than a DID when fetching fails', async (error) => {
            const c = context('err.com');
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error));
            await handle(c as never);
            expect(c.json).toHaveBeenCalledWith({ error: error.message }, 500);
        },
    );

    it('returns 500 on an unknown exception', async () => {
        const c = context('unknown.com');
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue('unknown'));
        await handle(c as never);
        expect(c.json).toHaveBeenCalledWith({ error: 'Unknown error' }, 500);
    });
});
