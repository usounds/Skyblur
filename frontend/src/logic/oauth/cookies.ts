import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { SESSION_TTL_SECONDS } from './constants';

export const OAUTH_DID_COOKIE = "__Host-oauth_did";
export const OAUTH_CALLBACK_COOKIE = "__Host-oauth_callback";
export const OAUTH_STATE_COOKIE = "__Host-oauth_state";

function getCookieSecret() {
  const secret = process.env.SESSION_SECRET || process.env.OAUTH_PRIVATE_KEY_JWK;
  if (!secret) {
    throw new Error("SESSION_SECRET or OAUTH_PRIVATE_KEY_JWK is required");
  }
  return secret;
}

export type SignedBrowserSession = { did: string; sessionId: string; expiresAt: number };

export function signDid(did: string, sessionId: string = randomUUID(), expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS) {
  const payload = Buffer.from(JSON.stringify({ did, sessionId, expiresAt })).toString('base64url');
  const signed = `v1.${payload}`;
  // codeql[js/insufficient-password-hash] False positive: This is HMAC-SHA256 message authentication for browser session cookie integrity, not password hashing.
  const signature = createHmac("sha256", getCookieSecret())
    .update(signed)
    .digest("base64url");
  return `${signed}.${signature}`;
}

export function verifySignedSession(rawDid: string | undefined | null): SignedBrowserSession | null {
  if (!rawDid || rawDid.length > 4096) return null;
  const parts = rawDid.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1' || !/^[A-Za-z0-9_-]+$/.test(parts[1])) return null;
  const signed = `${parts[0]}.${parts[1]}`;
  const signature = parts[2];
  // codeql[js/insufficient-password-hash] False positive: This is HMAC-SHA256 signature verification for browser session cookie integrity, not password hashing.
  const expectedSignature = createHmac("sha256", getCookieSecret())
    .update(signed)
    .digest("base64url");

  try {
    const actual = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (actual.length === expected.length && timingSafeEqual(actual, expected)) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      if (typeof payload.did === 'string' && payload.did.startsWith('did:')
          && typeof payload.sessionId === 'string' && /^[a-zA-Z0-9-]{36}$/.test(payload.sessionId)
          && Number.isSafeInteger(payload.expiresAt) && payload.expiresAt > Math.floor(Date.now() / 1000)) {
        return { did: payload.did, sessionId: payload.sessionId, expiresAt: payload.expiresAt };
      }
    }
  } catch {
    return null;
  }

  return null;
}

// Signature parsing only. Authentication must also check the server-side binding.
export function verifySignedDid(rawDid: string | undefined | null) {
  return verifySignedSession(rawDid)?.did ?? null;
}

// Only accepted by the bounded migration path after checking a live OAuth grant.
export function verifyLegacySignedDid(raw: string | undefined | null): string | null {
  if (!raw || raw.length > 4096) return null;
  const index = raw.lastIndexOf('.');
  if (index < 0) return null;
  const did = raw.slice(0, index);
  if (!did.startsWith('did:')) return null;
  const signature = Buffer.from(raw.slice(index + 1));
  // codeql[js/insufficient-password-hash] False positive: This is HMAC-SHA256 signature verification for legacy DID cookie migration, not password hashing.
  const expected = Buffer.from(createHmac('sha256', getCookieSecret()).update(did).digest('base64url'));
  return signature.length === expected.length && timingSafeEqual(signature, expected) ? did : null;
}
