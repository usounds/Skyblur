import { ClientMetadata } from '@atcute/oauth-browser-client';

export type ClientMetadataByEnv = Record<string, ClientMetadata>;

// 共通スコープをまとめる
export const scopeList = [
  "atproto",
  "include:uk.skyblur.permissionSet",
  "rpc:app.bsky.actor.getProfile?aud=did:web:api.bsky.app%23bsky_appview",
  "repo:app.bsky.feed.post?action=create&action=delete",
  "repo:app.bsky.feed.generator?action=create&action=update&action=delete",
//  "repo:app.bsky.feed.threadgate?action=create&action=update&action=delete",
  "rpc:app.bsky.feed.getFeedGenerator?aud=*",
  "rpc:app.bsky.feed.searchPosts?aud=*",
  "blob:*/*",
].join(" ");

// 共通部分を base として定義（必須プロパティをすべて含める）
const baseClientMetadata: Omit<ClientMetadata, 
  'client_id' | 'client_name' | 'client_uri' | 'redirect_uris' | 'policy_uri' | 'tos_uri'> = {
  scope: scopeList,
  grant_types: ["authorization_code", "refresh_token"],
  response_types: ["code"],
  token_endpoint_auth_method: "none",
  logo_uri: "https://cdn.bsky.app/img/avatar/plain/did:plc:4sm3vprfyl55ui3yhjd7w4po/bafkreihmqcrmibizx6wpkqv7gdaqpyd25f5tjncsdg4f3n54ktp2orrm64@jpeg",
  dpop_bound_access_tokens: true,
};

// 環境ごとのクライアントメタデータ
export const clientMetadataByEnv: ClientMetadataByEnv = {
  local: {
    ...baseClientMetadata,
    client_id: "https://dev.skyblur.uk/api/client-metadata.json",
    client_name: "Skyblur Local",
    client_uri: "https://dev.skyblur.uk/",
    redirect_uris: ["https://dev.skyblur.uk/"],
    policy_uri: "https://dev.skyblur.uk/termofuse",
    tos_uri: "https://dev.skyblur.uk/termofuse",
  },
  preview: {
    ...baseClientMetadata,
    client_id: "https://preview.skyblur.uk/api/client-metadata.json",
    client_name: "Skyblur Preview",
    client_uri: "https://preview.skyblur.uk",
    redirect_uris: ["https://preview.skyblur.uk/"],
    policy_uri: "https://preview.skyblur.uk/termofuse",
    tos_uri: "https://preview.skyblur.uk/termofuse",
    application_type: "web",
  },
  production: {
    ...baseClientMetadata,
    client_id: "https://skyblur.uk/api/client-metadata.json",
    client_name: "Skyblur",
    client_uri: "https://skyblur.uk",
    redirect_uris: ["https://skyblur.uk/"],
    policy_uri: "https://skyblur.uk/termofuse",
    tos_uri: "https://skyblur.uk/termofuse",
    application_type: "web",
  },
};

// ホスト名から環境を判定してメタデータを取得
export const getClientMetadata = (): ClientMetadata | undefined => {
  const hostname = window.location.hostname;

  const env = hostname.includes("preview")
    ? "preview"
    : hostname.includes("dev.skyblur.uk")
    ? "local"
    : hostname.includes("skyblur.uk")
    ? "production"
    : "local";

  return clientMetadataByEnv[env];
};
