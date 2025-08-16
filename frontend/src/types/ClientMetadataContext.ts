
import { ClientMetadata } from '@atcute/oauth-browser-client';

export type ClientMetadataByEnv = Record<string, ClientMetadata>;

export const getClientMetadata: () => ClientMetadata | undefined = () => {
    let env;
    const origin = window.location.hostname;
    if (origin.includes('preview')) {
        env = 'preview';
    } else if (origin.includes('skyblur.uk')) {
        env = 'production';
    } else {
        env = 'local';
    }

    return clientMetadataByEnv[env]
};


export const clientMetadataByEnv: ClientMetadataByEnv = {
    local: {
        client_id: "https://skyblur.usounds.work/api/client-metadata.json",
        client_name: "Skyblur Local",
        redirect_uris: ["https://skyblur.usounds.work/"],
        client_uri: "https://skyblur.usounds.work/",
        scope: "atproto transition:generic",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
        policy_uri: "https://skyblur.usounds.work/termofuse",
        tos_uri: "https://skyblur.usounds.work/termofuse",
        logo_uri: "https://cdn.bsky.app/img/avatar/plain/did:plc:4sm3vprfyl55ui3yhjd7w4po/bafkreihmqcrmibizx6wpkqv7gdaqpyd25f5tjncsdg4f3n54ktp2orrm64@jpeg",
        dpop_bound_access_tokens: true,
    },
    preview: {
        client_id: "https://preview.skyblur.uk/api/client-metadata.json",
        client_name: "Skyblur Preview",
        client_uri: "https://preview.skyblur.uk",
        logo_uri: "https://cdn.bsky.app/img/avatar/plain/did:plc:4sm3vprfyl55ui3yhjd7w4po/bafkreihmqcrmibizx6wpkqv7gdaqpyd25f5tjncsdg4f3n54ktp2orrm64@jpeg",
        tos_uri: "https://preview.skyblur.uk/termofuse",
        policy_uri: "https://preview.skyblur.uk/termofuse",
        redirect_uris: ["https://preview.skyblur.uk/"],
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
        logo_uri: "https://cdn.bsky.app/img/avatar/plain/did:plc:4sm3vprfyl55ui3yhjd7w4po/bafkreihmqcrmibizx6wpkqv7gdaqpyd25f5tjncsdg4f3n54ktp2orrm64@jpeg",
        tos_uri: "https://skyblur.uk/termofuse",
        policy_uri: "https://skyblur.uk/termofuse",
        redirect_uris: ["https://skyblur.uk/"],
        scope: "atproto transition:generic",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
        application_type: "web",
        dpop_bound_access_tokens: true,
    },
};
