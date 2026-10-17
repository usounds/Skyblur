import { describe, expect, it, vi } from 'vitest';
import { BodyLimitError, readBodyBytes, readResponseText } from '../boundedBody';

const signal = () => AbortSignal.timeout(1000);

describe('bounded body reads', () => {
  it('accepts exactly the limit and counts UTF-8 bytes', async () => {
    expect(await readResponseText(new Response('あ'), 3, signal())).toBe('あ');
    await expect(readResponseText(new Response('あ'), 2, signal())).rejects.toBeInstanceOf(BodyLimitError);
  });
  it.each([undefined, '1'])('stops a chunked body with missing or lying length %s', async (length) => {
    const cancel = vi.fn();
    let reads = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) { reads++; controller.enqueue(new Uint8Array(4)); }, cancel,
    }, { highWaterMark: 0 });
    const response = new Response(body, { headers: length ? { 'content-length': length } : undefined });
    await expect(readResponseText(response, 8, signal())).rejects.toBeInstanceOf(BodyLimitError);
    expect(reads).toBe(3);
    expect(cancel).toHaveBeenCalledOnce();
  });
  it('rejects a declared oversized body before reading it', async () => {
    const pull = vi.fn(); const cancel = vi.fn();
    const response = new Response(new ReadableStream({ pull, cancel }, { highWaterMark: 0 }), {
      headers: { 'content-length': '1000' },
    });
    await expect(readResponseText(response, 10, signal())).rejects.toBeInstanceOf(BodyLimitError);
    expect(pull).not.toHaveBeenCalled(); expect(cancel).toHaveBeenCalledOnce();
  });
  it('aborts a stalled body even when cancellation never settles', async () => {
    const cancel = vi.fn(() => new Promise<void>(() => {}));
    const body = new ReadableStream<Uint8Array>({ pull: () => new Promise<void>(() => {}), cancel });
    await expect(readBodyBytes(body, 100, AbortSignal.timeout(10))).rejects.toMatchObject({ name: 'TimeoutError' });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('matches the canonical shared definition without drift', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const canonicalPath = path.resolve(__dirname, '../../../../shared/logic/boundedBody.ts');
    if (!fs.existsSync(canonicalPath)) return;
    const localContent = fs.readFileSync(path.resolve(__dirname, '../boundedBody.ts'), 'utf8');
    const canonicalContent = fs.readFileSync(canonicalPath, 'utf8');
    expect(localContent).toBe(canonicalContent);
  });
});
