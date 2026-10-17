import { afterEach, describe, expect, it } from "vitest";

import {
  getAppOriginFromRequest,
  getCookieDomain,
  getRequestOrigin,
  isAllowedOrigin,
} from "../origin";

function request(url: string, headers?: HeadersInit) {
  return new Request(url, { headers });
}

describe("OAuth origin helpers", () => {
  const originalBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  afterEach(() => {
    if (originalBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_BASE_URL = originalBaseUrl;
    }
  });

  it("uses the configured base URL as the request origin for untrusted hosts", () => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://skyblur.uk/";
    const req = request("https://internal.example/api", {
      "x-forwarded-host": "attacker.example",
      host: "attacker.example",
    });

    expect(getRequestOrigin(req)).toBe("https://skyblur.uk");
    expect(getAppOriginFromRequest(req)).toBe("https://skyblur.uk");
  });

  it("uses the request URL protocol for localhost when no base URL is configured", () => {
    delete process.env.NEXT_PUBLIC_BASE_URL;
    const req = request("http://localhost:4500/api", {
      host: "localhost:4500",
      "x-forwarded-proto": "https",
    });

    expect(getRequestOrigin(req)).toBe("http://localhost:4500");
    expect(getCookieDomain(req)).toBeUndefined();
  });

  it("uses the configured base URL host for legacy cookie domains", () => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://app.skyblur.uk";
    const req = request("https://attacker.example/api");

    expect(getCookieDomain(req)).toBe(".skyblur.uk");
  });

  it("rejects non-localhost requests when no base URL is configured", () => {
    delete process.env.NEXT_PUBLIC_BASE_URL;
    const req = request("https://intranet/api", {
      host: "intranet",
    });

    expect(() => getRequestOrigin(req)).toThrow("NEXT_PUBLIC_BASE_URL is required");
    expect(() => getCookieDomain(req)).toThrow("NEXT_PUBLIC_BASE_URL is required");
  });

  it("rejects base URLs with path, query, or hash", () => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://skyblur.uk/console";
    const req = request("https://skyblur.uk/api");

    expect(() => getRequestOrigin(req)).toThrow("NEXT_PUBLIC_BASE_URL must be an origin");
  });

  it("validates origin headers correctly with isAllowedOrigin", () => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://skyblur.uk";

    // No origin header (non-browser or server-to-server)
    expect(isAllowedOrigin(request("https://skyblur.uk/xrpc/test"))).toBe(true);

    // Matching origin header
    expect(isAllowedOrigin(request("https://skyblur.uk/xrpc/test", { origin: "https://skyblur.uk" }))).toBe(true);

    // Mismatched origin header (CSRF attack)
    expect(isAllowedOrigin(request("https://skyblur.uk/xrpc/test", { origin: "https://evil.com" }))).toBe(false);

    // Origin calculation throws error (e.g. invalid config)
    delete process.env.NEXT_PUBLIC_BASE_URL;
    expect(isAllowedOrigin(request("https://intranet/xrpc/test", { host: "intranet", origin: "https://intranet" }))).toBe(false);

    // Localhost origin matching during local dev or e2e tests
    expect(isAllowedOrigin(request("http://localhost:4501/api/logout", { host: "localhost:4501", origin: "http://localhost:4501" }))).toBe(true);
    expect(isAllowedOrigin(request("http://localhost:4501/api/logout", { host: "localhost:4501", origin: "http://evil.com" }))).toBe(false);
  });
});
