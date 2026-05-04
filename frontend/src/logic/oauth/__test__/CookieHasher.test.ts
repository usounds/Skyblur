import { describe, expect, it } from "vitest";

import { CookieHasher } from "../CookieHasher";

describe("CookieHasher", () => {
  it("round-trips signed values", () => {
    const signed = CookieHasher.sign("did:plc:abc");

    expect(CookieHasher.verify(signed)).toBe("did:plc:abc");
  });

  it("rejects malformed and tampered values", () => {
    const signed = CookieHasher.sign("value");

    expect(CookieHasher.verify("missing-signature")).toBeNull();
    expect(CookieHasher.verify(`${signed}x`)).toBeNull();
  });
});
