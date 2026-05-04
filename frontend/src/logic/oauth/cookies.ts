import { createHmac, timingSafeEqual } from "node:crypto";

export const OAUTH_DID_COOKIE = "__Host-oauth_did";
export const OAUTH_CALLBACK_COOKIE = "__Host-oauth_callback";

function getCookieSecret() {
  const secret = process.env.SESSION_SECRET || process.env.OAUTH_PRIVATE_KEY_JWK;
  if (!secret) {
    throw new Error("SESSION_SECRET or OAUTH_PRIVATE_KEY_JWK is required");
  }
  return secret;
}

export function signDid(did: string) {
  const signature = createHmac("sha256", getCookieSecret())
    .update(did)
    .digest("base64url");
  return `${did}.${signature}`;
}

export function verifySignedDid(rawDid: string | undefined | null) {
  if (!rawDid) return null;

  const lastDotIndex = rawDid.lastIndexOf(".");
  if (lastDotIndex === -1) return null;

  const did = rawDid.substring(0, lastDotIndex);
  const signature = rawDid.substring(lastDotIndex + 1);
  const expectedSignature = createHmac("sha256", getCookieSecret())
    .update(did)
    .digest("base64url");

  try {
    const actual = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (actual.length === expected.length && timingSafeEqual(actual, expected)) {
      return did;
    }
  } catch {
    return null;
  }

  return null;
}
