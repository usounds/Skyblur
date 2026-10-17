import { Context } from 'hono'
import { isDid, isHandle } from '@atcute/lexicons/syntax';
import { isPublicDnsHostname } from '@/logic/publicDnsHostname';

async function readDid(response: Response): Promise<string | null> {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      // DID syntax permits at most 2048 characters. Bound the remote body
      // while streaming rather than allocating an unbounded response.text().
      if (bytes > 2048) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    const did = (text + decoder.decode()).trim();
    return isDid(did) && (did.startsWith('did:plc:') || did.startsWith('did:web:')) ? did : null;
  } finally {
    reader.releaseLock();
  }
}

export const handle = async (c: Context) => {
  const urlObj = new URL(c.req.url);
  const handleParam = urlObj.searchParams.get("handle");

  if (!handleParam) {
    return c.json({ error: "Missing handle" }, 400);
  }

  const normalizedHandle = handleParam.toLowerCase();
  if (!isHandle(normalizedHandle) || !isPublicDnsHostname(normalizedHandle)) {
    return c.json({ error: 'Invalid handle' }, 400);
  }

  try {
    const url = new URL("/.well-known/atproto-did", `https://${normalizedHandle}`);
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(5_000) });

    if (!response.ok || (response.status >= 300 && response.status < 400)) {
      return c.json({ error: "Domain is unreachable" }, 502);
    }

    const did = await readDid(response);
    if (!did) {
      return c.json({ error: "Invalid DID" }, 400);
    }

    return c.json({ did });
  } catch (err: unknown) {
    if (err instanceof Error) {
      return c.json({ error: err.message }, 500);
    }
    return c.json({ error: "Unknown error" }, 500);
  }
};
