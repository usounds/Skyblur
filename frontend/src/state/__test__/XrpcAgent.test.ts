import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getMissingAppBskyRpcScopes, useXrpcAgentStore } from "../XrpcAgent";

describe("useXrpcAgentStore.checkSession", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useXrpcAgentStore.setState({
      did: "",
      serviceUrl: "",
      isSessionChecked: false,
      userProf: null,
      scope: "",
      missingAppBskyRpcScopes: [],
    });
    useXrpcAgentStore.getState().setIsSessionChecked(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps the session unresolved when session check times out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
      ),
    );

    const session = useXrpcAgentStore.getState().checkSession();

    await vi.advanceTimersByTimeAsync(10_000);

    await expect(session).resolves.toEqual({ authenticated: false, did: "", pds: "", timedOut: true });
    expect(useXrpcAgentStore.getState().isSessionChecked).toBe(false);
    expect(useXrpcAgentStore.getState().did).toBe("");
  });

  it("restores a lightweight authenticated session without profile data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              authenticated: true,
              did: "did:plc:test",
              pds: "https://pds.example.test",
              scope: "atproto repo:app.bsky.feed.post?action=create",
            }),
            { headers: { "content-type": "application/json" } },
          ),
        ),
      ),
    );

    await expect(useXrpcAgentStore.getState().checkSession()).resolves.toEqual({
      authenticated: true,
      did: "did:plc:test",
      pds: "https://pds.example.test",
      scope: "atproto repo:app.bsky.feed.post?action=create",
      missingAppBskyRpcScopes: [
        "rpc:app.bsky.actor.getProfile?aud=did:web:api.bsky.app%23bsky_appview",
        "rpc:app.bsky.graph.getLists?aud=*",
        "rpc:app.bsky.graph.getList?aud=*",
        "rpc:app.bsky.feed.getFeedGenerator?aud=*",
        "rpc:app.bsky.feed.searchPosts?aud=*",
      ],
    });

    expect(useXrpcAgentStore.getState()).toMatchObject({
      did: "did:plc:test",
      serviceUrl: "https://pds.example.test",
      isSessionChecked: true,
      userProf: null,
      scope: "atproto repo:app.bsky.feed.post?action=create",
      missingAppBskyRpcScopes: [
        "rpc:app.bsky.actor.getProfile?aud=did:web:api.bsky.app%23bsky_appview",
        "rpc:app.bsky.graph.getLists?aud=*",
        "rpc:app.bsky.graph.getList?aud=*",
        "rpc:app.bsky.feed.getFeedGenerator?aud=*",
        "rpc:app.bsky.feed.searchPosts?aud=*",
      ],
    });
  });

  it("checks only app.bsky rpc scopes for relogin requirements", () => {
    expect(getMissingAppBskyRpcScopes("atproto rpc:app.bsky.graph.getLists?aud=*")).toContain(
      "rpc:app.bsky.graph.getList?aud=*",
    );
    expect(getMissingAppBskyRpcScopes("atproto rpc:uk.skyblur.post.getPost?aud=*")).toContain(
      "rpc:app.bsky.graph.getLists?aud=*",
    );
  });

  it("detects app.bsky graph scopes missing from older sessions", () => {
    const olderScope = [
      "repo?collection=uk.skyblur.post&collection=uk.skyblur.preference",
      "rpc?lxm=uk.skyblur.post.deleteStored&lxm=uk.skyblur.post.encrypt&lxm=uk.skyblur.post.getPost&lxm=uk.skyblur.post.store&aud=*",
      "atproto",
      "rpc:app.bsky.actor.getProfile?aud=did:web:api.bsky.app%23bsky_appview",
      "repo:app.bsky.feed.post?action=create&action=delete",
      "repo:app.bsky.feed.generator?action=create&action=update&action=delete",
      "repo:app.bsky.feed.threadgate?action=create&action=update&action=delete",
      "repo:app.bsky.feed.postgate?action=create&action=update&action=delete",
      "rpc:app.bsky.feed.getFeedGenerator?aud=*",
      "rpc:app.bsky.feed.searchPosts?aud=*",
      "blob:*/*",
    ].join(" ");

    expect(getMissingAppBskyRpcScopes(olderScope)).toEqual([
      "rpc:app.bsky.graph.getLists?aud=*",
      "rpc:app.bsky.graph.getList?aud=*",
    ]);
  });
});
