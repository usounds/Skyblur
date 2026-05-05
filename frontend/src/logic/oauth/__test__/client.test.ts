import { afterEach, describe, expect, it, vi } from "vitest";

import {
  guardedOAuthFetch,
  isSafeOAuthResourceUrl,
  isUnsafeOAuthResourceError,
  restoreSession,
} from "../client";

describe("OAuth client SSRF guards", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts public HTTPS resource URLs", () => {
    expect(isSafeOAuthResourceUrl("https://bsky.social")).toBe(true);
    expect(isSafeOAuthResourceUrl("https://pds.example.com")).toBe(true);
  });

  it("rejects local, IP literal, credentialed, and non-HTTPS resource URLs", () => {
    expect(isSafeOAuthResourceUrl("http://bsky.social")).toBe(false);
    expect(isSafeOAuthResourceUrl("https://127.0.0.1")).toBe(false);
    expect(isSafeOAuthResourceUrl("https://[::1]")).toBe(false);
    expect(isSafeOAuthResourceUrl("https://localhost.localdomain")).toBe(false);
    expect(isSafeOAuthResourceUrl("https://pds.internal")).toBe(false);
    expect(isSafeOAuthResourceUrl("https://user:pass@pds.example.com")).toBe(false);
  });

  it("blocks unsafe fetch targets before the network", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response("{}")));
    vi.stubGlobal("fetch", fetchMock);

    expect(() => guardedOAuthFetch("https://127.0.0.1/.well-known/did.json")).toThrow(
      "Unsafe OAuth resource URL",
    );
    await expect(guardedOAuthFetch("https://pds.example.com/.well-known/did.json")).resolves.toBeInstanceOf(Response);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects restored sessions with unsafe token audiences", async () => {
    const session = {
      getTokenInfo: vi.fn(() => Promise.resolve({
        aud: "https://127.0.0.1",
        scope: "atproto",
      })),
    };
    const oauth = {
      restore: vi.fn(() => Promise.resolve(session)),
    };

    await expect(restoreSession(oauth as never, "did:plc:test")).rejects.toSatisfy(
      isUnsafeOAuthResourceError,
    );
    expect(oauth.restore).toHaveBeenCalledWith("did:plc:test", { refresh: false });
    expect(session.getTokenInfo).toHaveBeenCalledWith(false);
  });
});
