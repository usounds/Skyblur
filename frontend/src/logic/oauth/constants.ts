export const SESSION_TTL_SECONDS = 180 * 24 * 60 * 60;
export const STATE_TTL_SECONDS = 10 * 60;
export const OAUTH_METADATA_TTL_SECONDS = 60 * 60;
export const LOCK_TTL_SECONDS = 60;

export const scopeList = [
  "atproto",
  "include:uk.skyblur.permissionSet",
  "rpc:app.bsky.actor.getProfile?aud=did:web:api.bsky.app%23bsky_appview",
  "repo:app.bsky.feed.post?action=create&action=delete",
  "repo:app.bsky.feed.generator?action=create&action=update&action=delete",
  "repo:app.bsky.feed.threadgate?action=create&action=update&action=delete",
  "repo:app.bsky.feed.postgate?action=create&action=update&action=delete",
  "rpc:app.bsky.graph.getLists?aud=*",
  "rpc:app.bsky.graph.getList?aud=*",
  "rpc:app.bsky.feed.getFeedGenerator?aud=*",
  "rpc:app.bsky.feed.searchPosts?aud=*",
  "blob:*/*",
].join(" ");
