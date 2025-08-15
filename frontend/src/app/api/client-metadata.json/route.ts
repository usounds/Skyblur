import { getCloudflareContext } from "@opennextjs/cloudflare";
export async function GET() {

  const obj = {
    "client_id": `https://${getCloudflareContext().env.APP_VIEW_URL}/api/client-metadata.json`,
    "client_name": "Skyblur",
    "client_uri": `https://${getCloudflareContext().env.APP_VIEW_URL}`,
    "logo_uri": `https://${getCloudflareContext().env.APP_VIEW_URL}/favicon.ico`,
    "tos_uri": `https://${getCloudflareContext().env.APP_VIEW_URL}/termofuse`,
    "policy_uri": `https://${getCloudflareContext().env.APP_VIEW_URL}/termofuse`,
    "redirect_uris": [`https://${getCloudflareContext().env.APP_VIEW_URL}/api/oauth/callback`],
    "scope": "atproto transition:generic",
    "grant_types": ["authorization_code", "refresh_token"],
    "response_types": ["code"],
    "token_endpoint_auth_method": "private_key_jwt",
    "jwks_uri": `https://${getCloudflareContext().env.APP_VIEW_URL}/api/jwks.json`,
    "application_type": "web",
    "token_endpoint_auth_signing_alg": "ES256",
    "dpop_bound_access_tokens": true
  }

  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: {
      'content-type': 'application/json'
    }
  });

}