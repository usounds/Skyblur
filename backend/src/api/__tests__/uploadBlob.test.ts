import { describe, it, expect, vi } from 'vitest';
import { handle } from '../uploadBlob';

describe('uploadBlob API', () => {
    it('should upload blob via client', async () => {
        const c: any = {
            req: {
                header: vi.fn().mockReturnValue('image/png'),
                arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10))
            },
            json: vi.fn()
        };

        const mockClient = {
            post: vi.fn().mockResolvedValue({
                ok: true,
                data: { blob: 'some-blob' }
            })
        };

        await handle(c, mockClient as any);

        expect(mockClient.post).toHaveBeenCalledWith('com.atproto.repo.uploadBlob', expect.objectContaining({
            headers: { 'content-type': 'image/png' }
        }));
        expect(c.json).toHaveBeenCalledWith({ blob: 'some-blob' }, 200);
    });

    it('should return error if content-type is missing', async () => {
        const c: any = {
            req: { header: vi.fn().mockReturnValue(null) },
            json: vi.fn()
        };
        await handle(c, {} as any);
        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'InvalidRequest' }), 400);
    });

    it('should handle client error', async () => {
        const c: any = {
            req: {
                header: vi.fn().mockReturnValue('image/png'),
                arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10))
            },
            json: vi.fn()
        };
        const mockClient = {
            post: vi.fn().mockResolvedValue({
                ok: false,
                data: { error: 'UploadFailed' }
            })
        };

        await handle(c, mockClient as any);
        expect(c.json).toHaveBeenCalledWith({ error: 'UploadFailed' }, 400);
    });

    it('should handle exception', async () => {
        const c: any = {
            req: {
                header: vi.fn().mockReturnValue('image/png'),
                arrayBuffer: vi.fn().mockRejectedValue(new Error('Buffer Error'))
            },
            json: vi.fn()
        };

        await handle(c, {} as any);
        expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'InternalServerError' }), 500);
    });
});
