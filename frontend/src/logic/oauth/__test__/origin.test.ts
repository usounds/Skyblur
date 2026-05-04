import { afterEach, describe, expect, it } from "vitest";

import {
  getAppOriginFromRequest,
  getCookieDomain,
  getRequestOrigin,
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

  it("uses the configured base URL as the request origin", () => {
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
});
