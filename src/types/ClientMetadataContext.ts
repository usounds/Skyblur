
import { OAuthClientMetadataInput } from '@atproto/oauth-types';

export type ClientMetadataByEnv = Record<string, OAuthClientMetadataInput>;

export const getClientMetadata: () => OAuthClientMetadataInput | undefined = () => {
    let env;
    const origin = window.location.hostname;
    if (origin.includes('skyblur.uk')) {
        env = 'production';
    } else if (origin.includes('preview')) {
        env = 'preview';
    } else if (origin.includes('sakura.ne.jp')) {
        env = 'apprun';
    } else {
        env = 'local';
    }

    return clientMetadataByEnv[env]
};


export const clientMetadataByEnv: ClientMetadataByEnv = {
    local: {
        client_id: "https://blursky.usounds.work/api/client-metadata.json",
        client_name: "Skyblur Local",
        redirect_uris: ["https://blursky.usounds.work/oauth"],
        client_uri: "https://blursky.usounds.work/",
        scope: "atproto transition:generic",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
        policy_uri: "https://blursky.usounds.work/termofuse",
        tos_uri: "https://blursky.usounds.work/termofuse",
        dpop_bound_access_tokens: true,
    },
    preview: {
        client_id: "https://preview.skyblur.pages.dev/api/client-metadata.json",
        client_name: "Skyblur Preview",
        client_uri: "https://preview.skyblur.pages.dev",
        logo_uri: "https://preview.skyblur.pages.dev/favicon.ico",
        tos_uri: "https://preview.skyblur.pages.dev/termofuse",
        policy_uri: "https://preview.skyblur.pages.dev/termofuse",
        redirect_uris: ["https://preview.skyblur.pages.dev/oauth"],
        scope: "atproto transition:generic",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
        application_type: "web",
        dpop_bound_access_tokens: true,
    },
    production: {
        client_id: "https://skyblur.uk/api/client-metadata.json",
        client_name: "Skyblur",
        client_uri: "https://skyblur.uk",
        logo_uri: "https://skyblur.uk/favicon.ico",
        tos_uri: "https://skyblur.uk/termofuse",
        policy_uri: "https://skyblur.uk/termofuse",
        redirect_uris: ["https://skyblur.uk/oauth"],
        scope: "atproto transition:generic",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
        application_type: "web",
        dpop_bound_access_tokens: true,
    },
};
