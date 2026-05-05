import { beforeEach, describe, it, expect, vi } from 'vitest';
import { handle } from '../store';
import * as AuthUtils from '@/logic/AuthUtils';
import { UkSkyblurPostStore } from '@/lexicon/index';
import * as ListVisibility from '../listVisibility';

vi.mock('@/logic/AuthUtils');
vi.mock('../listVisibility');

describe('store API', () => {
    beforeEach(() => {
        // @ts-ignore
        ListVisibility.isValidListUri.mockReturnValue(true);
        // @ts-ignore
        ListVisibility.assertListOwnedByRepo.mockResolvedValue(true);
    });

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

    it('should require listUri for list visibility', async () => {
        const input = {
            text: 'Hello',
            uri: 'at://did:example:user/uk.skyblur.post/123',
            visibility: 'list',
            additional: ''
        };
        const c: any = {
            req: { json: vi.fn().mockResolvedValue(input) },
            json: vi.fn()
        };
        // @ts-ignore
        AuthUtils.getAuthenticatedDid.mockResolvedValue('did:example:user');

        await handle(c);
        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'listUri is required for list visibility' }), 400);
    });

    it('should reject invalid listUri', async () => {
        // @ts-ignore
        ListVisibility.isValidListUri.mockReturnValue(false);
        const input = {
            text: 'Hello',
            uri: 'at://did:example:user/uk.skyblur.post/123',
            visibility: 'list',
            listUri: 'at://did:example:other/app.bsky.graph.list/list1',
            additional: ''
        };
        const c: any = {
            req: { json: vi.fn().mockResolvedValue(input) },
            json: vi.fn()
        };
        // @ts-ignore
        AuthUtils.getAuthenticatedDid.mockResolvedValue('did:example:user');

        await handle(c);
        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Invalid listUri' }), 400);
    });

    it('should pass listUri to the DO for list visibility', async () => {
        const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
        const input = {
            text: 'Hello',
            uri: 'at://did:example:user/uk.skyblur.post/123',
            visibility: 'list',
            listUri: 'at://did:example:user/app.bsky.graph.list/list1',
            additional: ''
        };
        const c: any = {
            req: { json: vi.fn().mockResolvedValue(input) },
            json: vi.fn(),
            env: {
                SKYBLUR_DO_RESTRICTED: {
                    idFromName: vi.fn().mockReturnValue('do-id'),
                    get: vi.fn().mockReturnValue({ fetch })
                }
            }
        };
        // @ts-ignore
        AuthUtils.getAuthenticatedDid.mockResolvedValue('did:example:user');

        await handle(c);

        const request = fetch.mock.calls[0][0] as Request;
        await expect(request.json()).resolves.toMatchObject({
            visibility: 'list',
            listUri: 'at://did:example:user/app.bsky.graph.list/list1',
        });
        expect(c.json).toHaveBeenCalledWith({ success: true });
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
