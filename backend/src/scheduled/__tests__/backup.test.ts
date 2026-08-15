import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { handleBackup } from '../backup';
import type { Env } from '@/index';

describe('handleBackup', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('backs up both RestrictedPostDO and PostMirrorDO into R2', async () => {
        const puts: { key: string; value: string }[] = [];
        const mockR2Bucket = {
            put: vi.fn(async (key: string, value: string) => {
                puts.push({ key, value });
            }),
        } as any;

        const mockRestrictedStub = {
            fetch: vi.fn(async (url: string) => {
                if (url === 'http://do/dump') {
                    return new Response(JSON.stringify({
                        did: 'did:plc:user1',
                        posts: [{ rkey: 'post1', text: 'encrypted-text' }],
                    }), { status: 200 });
                }
                return new Response('Not found', { status: 404 });
            }),
        };

        const mockMirrorStub = {
            fetch: vi.fn(async (url: string) => {
                if (url === 'http://do/dump') {
                    return new Response(JSON.stringify({
                        repo: 'did:plc:user1',
                        did: 'did:plc:user1',
                        records: [{ rkey: 'post1', repo: 'did:plc:user1' }],
                        recordOrder: [{ event_id: 'ev-1' }],
                        backfillState: [],
                        meta: [],
                    }), { status: 200 });
                }
                return new Response('Not found', { status: 404 });
            }),
        };

        const mockEnv: Partial<Env> = {
            CLOUDFLARE_ACCOUNT_ID: 'acc-123',
            CLOUDFLARE_API_TOKEN: 'token-abc',
            SKYBLUR_BACKUP: mockR2Bucket,
            SKYBLUR_DO_RESTRICTED: {
                idFromString: vi.fn((id: string) => id as any),
                get: vi.fn(() => mockRestrictedStub as any),
            } as any,
            SKYBLUR_DO_POST_MIRROR: {
                idFromString: vi.fn((id: string) => id as any),
                get: vi.fn(() => mockMirrorStub as any),
            } as any,
        };

        globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
            const url = input.toString();
            if (url.includes('/workers/durable_objects/namespaces') && !url.includes('/objects')) {
                return new Response(JSON.stringify({
                    result: [
                        { id: 'ns-restricted', class: 'RestrictedPostDO' },
                        { id: 'ns-mirror', class: 'PostMirrorDO' },
                    ],
                }), { status: 200 });
            }
            if (url.includes('/namespaces/ns-restricted/objects')) {
                return new Response(JSON.stringify({
                    result: [{ id: 'obj-restricted-1' }],
                    result_info: {},
                }), { status: 200 });
            }
            if (url.includes('/namespaces/ns-mirror/objects')) {
                return new Response(JSON.stringify({
                    result: [{ id: 'obj-mirror-1' }],
                    result_info: {},
                }), { status: 200 });
            }
            return new Response('Not found', { status: 404 });
        }) as any;

        const scheduledEvent = {} as ScheduledEvent;
        const ctx = {} as ExecutionContext;

        await handleBackup(scheduledEvent, mockEnv as Env, ctx);

        expect(puts).toHaveLength(2);

        const restrictedBackup = puts.find((p) => p.key.startsWith('restricted_posts/'));
        expect(restrictedBackup).toBeDefined();
        expect(restrictedBackup?.key).toMatch(/^restricted_posts\/[^/]+\/did:plc:user1\.json$/);
        expect(JSON.parse(restrictedBackup!.value)).toEqual({
            did: 'did:plc:user1',
            posts: [{ rkey: 'post1', text: 'encrypted-text' }],
        });

        const mirrorBackup = puts.find((p) => p.key.startsWith('post_mirrors/'));
        expect(mirrorBackup).toBeDefined();
        expect(mirrorBackup?.key).toMatch(/^post_mirrors\/[^/]+\/did:plc:user1\.json$/);
        expect(JSON.parse(mirrorBackup!.value)).toEqual(expect.objectContaining({
            repo: 'did:plc:user1',
            did: 'did:plc:user1',
            records: [{ rkey: 'post1', repo: 'did:plc:user1' }],
        }));
    });

    it('exits early if required credentials or backup bucket are missing', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await handleBackup({} as ScheduledEvent, {} as Env, {} as ExecutionContext);
        expect(consoleErrorSpy).toHaveBeenCalledWith('CLOUDFLARE_ACCOUNT_ID is not set.');

        await handleBackup({} as ScheduledEvent, { CLOUDFLARE_ACCOUNT_ID: 'acc' } as Env, {} as ExecutionContext);
        expect(consoleErrorSpy).toHaveBeenCalledWith('CLOUDFLARE_API_TOKEN is not set.');

        await handleBackup({} as ScheduledEvent, { CLOUDFLARE_ACCOUNT_ID: 'acc', CLOUDFLARE_API_TOKEN: 'tok' } as Env, {} as ExecutionContext);
        expect(consoleErrorSpy).toHaveBeenCalledWith('SKYBLUR_BACKUP binding is not set.');
    });
});
