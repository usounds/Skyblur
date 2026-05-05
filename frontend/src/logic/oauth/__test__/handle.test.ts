import { describe, expect, it } from "vitest";

import {
  getLikelyOAuthHandleTypo,
  isHandleResolutionError,
  isValidOAuthHandle,
  normalizeOAuthHandle,
} from "../handle";

describe("OAuth handle helpers", () => {
  it("normalizes optional handle input", () => {
    expect(normalizeOAuthHandle(" Shibata1945.BSKY.SOCAL ")).toBe("shibata1945.bsky.socal");
    expect(normalizeOAuthHandle("   ")).toBeNull();
    expect(normalizeOAuthHandle(null)).toBeNull();
  });

  it("accepts syntactically valid domain-like handles", () => {
    expect(isValidOAuthHandle("shibata1945.bsky.socal")).toBe(true);
    expect(isValidOAuthHandle("alice.bsky.social")).toBe(true);
  });

  it("detects common Bluesky handle typos", () => {
    expect(getLikelyOAuthHandleTypo("shibata1945.bsky.socal")).toBe("bsky.social");
    expect(getLikelyOAuthHandleTypo("alice.bsky.social")).toBeNull();
  });

  it("rejects malformed handles before OAuth resolution", () => {
    expect(isValidOAuthHandle("bad_handle")).toBe(false);
    expect(isValidOAuthHandle("@alice.bsky.social")).toBe(false);
    expect(isValidOAuthHandle("alice..bsky.social")).toBe(false);
    expect(isValidOAuthHandle("alice.bsky.social.")).toBe(false);
    expect(isValidOAuthHandle("-alice.bsky.social")).toBe(false);
  });

  it("detects resolver failures through nested causes", () => {
    const error = new Error("failed to resolve identity");
    error.name = "OAuthResolverError";
    error.cause = Object.assign(new Error("failed to resolve handle"), {
      name: "ActorResolutionError",
      cause: Object.assign(new Error("lookup failed"), {
        name: "FailedHandleResolutionError",
      }),
    });

    expect(isHandleResolutionError(error)).toBe(true);
    expect(isHandleResolutionError(new Error("database unavailable"))).toBe(false);
  });
});
