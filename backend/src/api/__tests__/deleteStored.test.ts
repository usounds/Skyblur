import { describe, it, expect, vi } from 'vitest';
import { handle } from '../deleteStored';
import * as AuthUtils from '@/logic/AuthUtils';

vi.mock('@/logic/AuthUtils');

describe('deleteStored API', () => {
    it('should delete from DO if authorized', async () => {
        // Mock Hono app fetch flow by testing the route handler logic indirectly is hard because simple 'handle' exports validation.
        // Wait, 'handle' exports `app.fetch`. We can simulate request.

        const env = {
            SKYBLUR_DO_RESTRICTED: {
                idFromName: vi.fn().mockReturnValue('id'),
                get: vi.fn().mockReturnValue({
                    fetch: vi.fn().mockResolvedValue(new Response('OK'))
                })
            }
        };

        // @ts-ignore
        AuthUtils.getAuthenticatedDid.mockResolvedValue('did:example:user');

        const request = new Request('http://localhost/', {
            method: 'POST',
            body: JSON.stringify({ uri: 'at://did:example:user/uk.skyblur.post/123' })
        });

        const c: any = { req: { raw: request }, env };

        const res = await handle(c);
        const json = await res.json();

        expect(json).toEqual({ success: true });
        expect(env.SKYBLUR_DO_RESTRICTED.get).toHaveBeenCalled();
    });

    it('should fail if URI does not match requester', async () => {
        const env = {};
        // @ts-ignore
        AuthUtils.getAuthenticatedDid.mockResolvedValue('did:example:user');

        const request = new Request('http://localhost/', {
            method: 'POST',
            body: JSON.stringify({ uri: 'at://did:other:user/uk.skyblur.post/123' })
        });

        const c: any = { req: { raw: request }, env };

        const res = await handle(c);
        const json = await (res as Response).json();

        expect((res as Response).status).toBe(403);
    });

    it('should fail if URI is missing', async () => {
        const req = new Request('http://localhost/', { method: 'POST', body: JSON.stringify({}) });
        const res = await handle({ req: { raw: req }, env: {} } as any);
        expect((res as Response).status).toBe(400);
    });

    it('should fail if not authenticated', async () => {
        // @ts-ignore
        AuthUtils.getAuthenticatedDid.mockResolvedValue(null);
        const req = new Request('http://localhost/', {
            method: 'POST',
            body: JSON.stringify({ uri: 'at://did/coll/rkey' })
        });
        const res = await handle({ req: { raw: req }, env: {} } as any);
        expect((res as Response).status).toBe(401);
    });

    it('should fail if URI is invalid (no rkey)', async () => {
        // @ts-ignore
        AuthUtils.getAuthenticatedDid.mockResolvedValue('did:user');
        const req = new Request('http://localhost/', {
            method: 'POST',
            body: JSON.stringify({ uri: 'at://did:user/uk.skyblur.post/' }) // trailing slash, empty rkey
        });
        const res = await handle({ req: { raw: req }, env: {} } as any);
        expect((res as Response).status).toBe(400);
    });

    it('should handle exceptions', async () => {
        const req = new Request('http://localhost/', { method: 'POST', body: 'invalid-json' });
        const res = await handle({ req: { raw: req }, env: {} } as any);
        expect((res as Response).status).toBe(500);
    });
});
