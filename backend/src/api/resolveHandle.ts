import { Context } from 'hono'

export const handle = async (c: Context) => {
  const urlObj = new URL(c.req.url);
  const handleParam = urlObj.searchParams.get("handle");

  if (!handleParam) {
    return c.json({ error: "Missing handle" }, 400);
  }

  try {
    const url = new URL("/.well-known/atproto-did", `https://${handleParam}`);
    const response = await fetch(url);

    if (!response.ok) {
      return c.json({ error: "Domain is unreachable" }, 502);
    }

    const text = await response.text();
    const did = text.split("\n")[0]!.trim();

    // validate did
    if (!did.startsWith("did:plc:") && !did.startsWith("did:web:")) {
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