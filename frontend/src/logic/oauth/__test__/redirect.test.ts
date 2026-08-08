import { describe, expect, it } from "vitest";

import { getOAuthLoginRedirectUrl } from "../redirect";

function locationAt(path: string) {
  const url = new URL(path, "https://preview.skyblur.uk");
  return {
    href: url.href,
    origin: url.origin,
    pathname: url.pathname,
  };
}

describe("getOAuthLoginRedirectUrl", () => {
  it.each(["/", "/ja", "/ja/", "/en", "/en/"])(
    "sends a login started from the home page to the console: %s",
    (path) => {
      expect(getOAuthLoginRedirectUrl(locationAt(path))).toBe(
        "https://preview.skyblur.uk/console",
      );
    },
  );

  it("keeps non-home return destinations and their query", () => {
    expect(getOAuthLoginRedirectUrl(locationAt("/post/did:plc:test/key?from=feed"))).toBe(
      "https://preview.skyblur.uk/post/did:plc:test/key?from=feed",
    );
  });
});
