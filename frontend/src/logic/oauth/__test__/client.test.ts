import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  guardedOAuthFetch,
  isSafeOAuthResourceUrl,
  isUnsafeOAuthResourceError,
  restoreSession,
} from "../client";

describe("OAuth client SSRF guards", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("USE_AWS_REAL_DB", "false");
    vi.stubEnv("OAUTH_STORE_TABLE_NAME", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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

    await expect(guardedOAuthFetch("https://127.0.0.1/.well-known/did.json")).rejects.toThrow(
      "Unsafe OAuth resource URL",
    );
    await expect(guardedOAuthFetch("https://pds.example.com/.well-known/did.json")).resolves.toBeInstanceOf(Response);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries safe OAuth discovery fetches on transient failures", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("network reset"))
      .mockResolvedValueOnce(new Response("temporary", { status: 503 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await guardedOAuthFetch("https://morel.us-east.host.bsky.network/.well-known/oauth-protected-resource");

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("falls back to cached protected resource metadata after retryable fetch failures", async () => {
    const metadata = {
      resource: "https://morel.us-east.host.bsky.network",
      authorization_servers: ["https://bsky.social"],
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(metadata), {
        status: 200,
        headers: { "content-type": "application/json" },
      }))
      .mockRejectedValueOnce(new TypeError("network reset"))
      .mockRejectedValueOnce(new TypeError("network reset"))
      .mockRejectedValueOnce(new TypeError("network reset"));
    vi.stubGlobal("fetch", fetchMock);

    const first = await guardedOAuthFetch(
      "https://morel.us-east.host.bsky.network/.well-known/oauth-protected-resource",
    );
    const fallback = await guardedOAuthFetch(
      "https://morel.us-east.host.bsky.network/.well-known/oauth-protected-resource",
    );

    await expect(first.json()).resolves.toEqual(metadata);
    await expect(fallback.json()).resolves.toEqual(metadata);
    expect(fallback.headers.get("content-type")).toContain("application/json");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("does not retry non-idempotent OAuth fetches", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("network reset"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(guardedOAuthFetch("https://bsky.social/oauth/par", { method: "POST" })).rejects.toThrow("network reset");
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
