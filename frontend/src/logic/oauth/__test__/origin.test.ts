import { describe, expect, it } from "vitest";

import {
  getAppOriginFromRequest,
  getCookieDomain,
  getRequestOrigin,
} from "../origin";

function request(url: string, headers?: HeadersInit) {
  return new Request(url, { headers });
}

describe("OAuth origin helpers", () => {
  it("uses forwarded host and protocol when present", () => {
    const req = request("https://internal.example/api", {
      "x-forwarded-host": "app.skyblur.example",
      "x-forwarded-proto": "https",
    });

    expect(getRequestOrigin(req)).toBe("https://app.skyblur.example");
    expect(getAppOriginFromRequest(req)).toBe("https://app.skyblur.example");
  });

  it("uses the request URL protocol for localhost", () => {
    const req = request("http://localhost:4500/api", {
      host: "localhost:4500",
      "x-forwarded-proto": "https",
    });

    expect(getRequestOrigin(req)).toBe("http://localhost:4500");
    expect(getCookieDomain(req)).toBeUndefined();
  });

  it("uses the registrable root as the cookie domain", () => {
    const req = request("https://api.skyblur.example/api", {
      host: "app.skyblur.example",
    });

    expect(getCookieDomain(req)).toBe(".skyblur.example");
  });

  it("does not set a cookie domain for single-label hosts", () => {
    const req = request("https://intranet/api", {
      host: "intranet",
    });

    expect(getCookieDomain(req)).toBeUndefined();
  });
});
