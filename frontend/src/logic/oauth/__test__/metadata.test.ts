import { describe, expect, it } from "vitest";

import { scopeList } from "../constants";
import { getClientMetadata } from "../metadata";

describe("getClientMetadata", () => {
  it("builds OAuth client metadata from the app origin", () => {
    expect(getClientMetadata("https://skyblur.example")).toEqual({
      client_id: "https://skyblur.example/oauth-client-metadata.json",
      client_name: "Skyblur",
      client_uri: "https://skyblur.example",
      tos_uri: "https://skyblur.example/ja/termofuse",
      policy_uri: "https://skyblur.example/ja/termofuse",
      redirect_uris: ["https://skyblur.example/api/oauth/callback"],
      jwks_uri: "https://skyblur.example/api/oauth/jwks.json",
      scope: scopeList,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "private_key_jwt",
      token_endpoint_auth_signing_alg: "ES256",
      dpop_bound_access_tokens: true,
    });
  });

  it("localizes OAuth terms and policy URLs", () => {
    const metadata = getClientMetadata("https://skyblur.example", "en");

    expect(metadata.tos_uri).toBe("https://skyblur.example/en/termofuse");
    expect(metadata.policy_uri).toBe("https://skyblur.example/en/termofuse");
  });
});
