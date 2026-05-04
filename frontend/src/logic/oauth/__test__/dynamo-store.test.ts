import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("requestOAuthLock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("USE_AWS_REAL_DB", "false");
    vi.stubEnv("OAUTH_STORE_TABLE_NAME", "");
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("uses a 60 second stale-lock TTL and owner-safe delete", async () => {
    const { requestOAuthLock } = await import("../dynamo-store");
    const { LOCK_TTL_SECONDS } = await import("../constants");
    expect(LOCK_TTL_SECONDS).toBe(60);

    let releaseFirst!: (value: string) => void;
    let firstEntered = false;
    const flushPromises = async () => {
      for (let i = 0; i < 5; i++) {
        await Promise.resolve();
      }
    };

    const first = requestOAuthLock(
      "same-session",
      () =>
        new Promise<string>((resolve) => {
          firstEntered = true;
          releaseFirst = resolve;
        }),
    );

    await flushPromises();
    expect(firstEntered).toBe(true);

    const second = requestOAuthLock("same-session", async () => "second");
    await flushPromises();

    await vi.advanceTimersByTimeAsync(59_000);
    let secondSettled = false;
    second.then(() => {
      secondSettled = true;
    });
    await flushPromises();
    expect(secondSettled).toBe(false);

    await vi.advanceTimersByTimeAsync(2_000);
    await flushPromises();
    await expect(second).resolves.toBe("second");

    releaseFirst("first");
    await expect(first).resolves.toBe("first");
  }, 10_000);
});
