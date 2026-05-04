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
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does not leave initial UI blocked when session check times out", async () => {
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

    await vi.advanceTimersByTimeAsync(6_000);

    await expect(session).resolves.toEqual({ authenticated: false, did: "", pds: "", timedOut: true });
    expect(useXrpcAgentStore.getState().isSessionChecked).toBe(true);
    expect(useXrpcAgentStore.getState().did).toBe("");
  });
});
