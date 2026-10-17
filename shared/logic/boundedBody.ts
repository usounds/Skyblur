/** Read delivered bytes with a hard bound, including chunked/decompressed bodies. */
export class BodyLimitError extends Error {
  constructor() { super('Body size limit exceeded'); this.name = 'BodyLimitError'; }
}

export async function readBodyBytes(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
  signal: AbortSignal,
): Promise<Uint8Array> {
  if (signal.aborted) {
    void body?.cancel().catch(() => {});
    signal.throwIfAborted();
  }
  if (!body) return new Uint8Array();
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let onAbort: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
  try {
    while (true) {
      const { value, done } = await Promise.race([reader.read(), aborted]);
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new BodyLimitError();
      chunks.push(value);
    }
    const result = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
    return result;
  } catch (error) {
    // Do not await cancellation: a hostile underlying source may never settle it.
    void reader.cancel().catch(() => {});
    throw error;
  } finally {
    signal.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }
}

export async function readResponseBytes(response: Response, maxBytes: number, signal: AbortSignal): Promise<Uint8Array> {
  const length = response.headers.get('content-length');
  if (length && Number(length) > maxBytes) {
    void response.body?.cancel().catch(() => {});
    throw new BodyLimitError();
  }
  return readBodyBytes(response.body, maxBytes, signal);
}

export async function readResponseText(response: Response, maxBytes: number, signal: AbortSignal): Promise<string> {
  return new TextDecoder().decode(await readResponseBytes(response, maxBytes, signal));
}
