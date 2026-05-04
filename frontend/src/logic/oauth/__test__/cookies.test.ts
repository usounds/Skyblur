import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalSessionSecret = process.env.SESSION_SECRET;
const originalPrivateKey = process.env.OAUTH_PRIVATE_KEY_JWK;

describe("signed DID cookies", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.SESSION_SECRET = "test-session-secret";
    delete process.env.OAUTH_PRIVATE_KEY_JWK;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.SESSION_SECRET = originalSessionSecret;
    process.env.OAUTH_PRIVATE_KEY_JWK = originalPrivateKey;
  });

  it("signs and verifies DIDs that contain dots", async () => {
    const { signDid, verifySignedDid } = await import("../cookies");
    const did = "did:web:alice.example.com";

    const signed = signDid(did);

    expect(signed).toMatch(/^did:web:alice\.example\.com\./);
    expect(verifySignedDid(signed)).toBe(did);
  });

  it("rejects missing, malformed, and tampered values", async () => {
    const { signDid, verifySignedDid } = await import("../cookies");
    const signed = signDid("did:plc:abc");

    expect(verifySignedDid(undefined)).toBeNull();
    expect(verifySignedDid(null)).toBeNull();
    expect(verifySignedDid("did:plc:abc")).toBeNull();
    expect(verifySignedDid(`${signed}tampered`)).toBeNull();
  });

  it("falls back to the OAuth private key secret", async () => {
    delete process.env.SESSION_SECRET;
    process.env.OAUTH_PRIVATE_KEY_JWK = "private-key-secret";
    vi.resetModules();

    const { signDid, verifySignedDid } = await import("../cookies");
    const signed = signDid("did:plc:private");

    expect(verifySignedDid(signed)).toBe("did:plc:private");
  });

  it("throws when no cookie secret is configured", async () => {
    delete process.env.SESSION_SECRET;
    delete process.env.OAUTH_PRIVATE_KEY_JWK;
    vi.resetModules();

    const { signDid } = await import("../cookies");

    expect(() => signDid("did:plc:missing-secret")).toThrow(
      "SESSION_SECRET or OAUTH_PRIVATE_KEY_JWK is required",
    );
  });
});
