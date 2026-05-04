import { scopeList } from "./constants";

export function getClientMetadata(origin: string) {
  return {
    client_id: `${origin}/oauth-client-metadata.json`,
    client_name: "Skyblur",
    client_uri: origin,
    redirect_uris: [`${origin}/api/oauth/callback`],
    jwks_uri: `${origin}/api/oauth/jwks.json`,
    scope: scopeList,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "private_key_jwt",
    token_endpoint_auth_signing_alg: "ES256",
    dpop_bound_access_tokens: true,
  };
}
