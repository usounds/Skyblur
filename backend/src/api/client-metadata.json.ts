import { Context } from 'hono'

export const handle = async (c: Context) => {
    const obj = {
        "client_id": `https://${c.env.API_HOST}/client-metadata.json`,
        "client_name": "Skyblur",
        "client_uri": `https://${c.env.API_HOST}`,
        "logo_uri": `https://${c.env.API_HOST}/favicon.ico`,
        "tos_uri": `https://${c.env.API_HOST}/termofuse`,
        "policy_uri": `https://${c.env.API_HOST}/termofuse`,
        "redirect_uris": [`https://${c.env.API_HOST}/oauth/callback`],
        "scope": "atproto transition:generic",
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
        "token_endpoint_auth_method": "private_key_jwt",
        "jwks_uri": `https://${c.env.API_HOST}/jwks.json`,
        "application_type": "web",
        "token_endpoint_auth_signing_alg": "ES256",
        "dpop_bound_access_tokens": true
    }

    return c.json(obj)

}