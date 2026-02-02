import { describe, it, expect, vi } from 'vitest';
import { handle } from '../store';
import * as AuthUtils from '@/logic/AuthUtils';
import { UkSkyblurPostStore } from '@/lexicon/index';

vi.mock('@/logic/AuthUtils');

describe('store API', () => {
    it('should store post if valid and authenticated', async () => {
        const input = {
            text: 'Hello',
            uri: 'at://did:example:user/uk.skyblur.post/123',
            visibility: 'followers',
            additional: ''
        };

        const c: any = {
            req: {
                json: vi.fn().mockResolvedValue(input)
            },
            json: vi.fn(),
            env: {
                SKYBLUR_DO_RESTRICTED: {
                    idFromName: vi.fn().mockReturnValue('do-id'),
                    get: vi.fn().mockReturnValue({
                        fetch: vi.fn().mockResolvedValue({ ok: true, status: 200 })
                    })
                }
            }
        };

        // @ts-ignore
        AuthUtils.getAuthenticatedDid.mockResolvedValue('did:example:user');

        await handle(c);

        expect(c.json).toHaveBeenCalledWith({ success: true });

        // Check schema validation implicitly passed (otherwise we return 400)
    });

    it('should fail if URI does not match authenticated user', async () => {
        const input = {
            text: 'Hello',
            uri: 'at://did:other:user/uk.skyblur.post/123',
            visibility: 'followers',
            additional: ''
        };
        const c: any = {
            req: { json: vi.fn().mockResolvedValue(input) },
            json: vi.fn()
        };
        // @ts-ignore
        AuthUtils.getAuthenticatedDid.mockResolvedValue('did:example:user');

        await handle(c);

        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('URI does not match authenticated user') }), 403);
    });

    it('should fail validation for invalid input', async () => {
        const input = {
            // missing text
            uri: 'at://did:example:user/uk.skyblur.post/123',
            visibility: 'followers'
        };
        const c: any = {
            req: { json: vi.fn().mockResolvedValue(input) },
            json: vi.fn()
        };

        await handle(c);

        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: expect.stringContaining('Validation failed') }), 400);
    });

    it('should fail if unauthenticated', async () => {
        const input = {
            text: 'Hello',
            uri: 'at://did:example:user/uk.skyblur.post/123',
            visibility: 'followers',
            additional: ''
        };
        const c: any = {
            req: { json: vi.fn().mockResolvedValue(input) },
            json: vi.fn()
        };
        // @ts-ignore
        AuthUtils.getAuthenticatedDid.mockResolvedValue(null);

        await handle(c);
        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Authentication required' }), 401);
    });

    it('should handle DO failure', async () => {
        const input = {
            text: 'Hello',
            uri: 'at://did:example:user/uk.skyblur.post/123',
            visibility: 'followers',
            additional: ''
        };
        const c: any = {
            req: { json: vi.fn().mockResolvedValue(input) },
            json: vi.fn(),
            env: {
                SKYBLUR_DO_RESTRICTED: {
                    idFromName: vi.fn().mockReturnValue('do-id'),
                    get: vi.fn().mockReturnValue({
                        fetch: vi.fn().mockResolvedValue({ ok: false, status: 500 })
                    })
                }
            }
        };
        // @ts-ignore
        AuthUtils.getAuthenticatedDid.mockResolvedValue('did:example:user');

        await handle(c);
        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Failed to store data' }), 500);
    });

    it('should handle exception during store process', async () => {
        const input = {
            text: 'Hello',
            uri: 'at://did:example:user/uk.skyblur.post/123',
            visibility: 'followers',
            additional: ''
        };
        const c: any = {
            req: { json: vi.fn().mockResolvedValue(input) },
            json: vi.fn(),
            env: {
                SKYBLUR_DO_RESTRICTED: {
                    idFromName: vi.fn().mockImplementation(() => { throw new Error('DO Error'); })
                }
            }
        };
        // @ts-ignore
        AuthUtils.getAuthenticatedDid.mockResolvedValue('did:example:user');

        await handle(c);
        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'Error: DO Error' }), 500);
    });
});
