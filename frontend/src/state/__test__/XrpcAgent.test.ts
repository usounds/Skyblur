import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useXrpcAgentStore } from "../XrpcAgent";

describe("useXrpcAgentStore.checkSession", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useXrpcAgentStore.setState({
      did: "",
      serviceUrl: "",
      isSessionChecked: false,
      userProf: null,
      scope: "",
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
    });

    expect(useXrpcAgentStore.getState()).toMatchObject({
      did: "did:plc:test",
      serviceUrl: "https://pds.example.test",
      isSessionChecked: true,
      userProf: null,
      scope: "atproto repo:app.bsky.feed.post?action=create",
    });
  });
});
