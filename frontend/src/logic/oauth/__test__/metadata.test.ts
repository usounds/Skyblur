import { describe, expect, it } from "vitest";

import { scopeList } from "../constants";
import { getClientMetadata } from "../metadata";

describe("getClientMetadata", () => {
  it("builds OAuth client metadata from the app origin", () => {
    expect(getClientMetadata("https://skyblur.example")).toEqual({
      client_id: "https://skyblur.example/oauth-client-metadata.json",
      client_name: "Skyblur",
      client_uri: "https://skyblur.example",
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
});
