import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Dynamo OAuth store", () => {
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
    vi.doUnmock("@aws-sdk/client-dynamodb");
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

  it("treats bundled ConditionalCheckFailedException shapes as lock contention", async () => {
    vi.stubEnv("USE_AWS_REAL_DB", "true");
    vi.stubEnv("OAUTH_STORE_TABLE_NAME", "oauth-store");

    const send = vi.fn()
      .mockRejectedValueOnce({
        __type: "com.amazonaws.dynamodb.v20120810#ConditionalCheckFailedException",
        $metadata: { httpStatusCode: 400 },
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    vi.doMock("@aws-sdk/client-dynamodb", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@aws-sdk/client-dynamodb")>();
      return {
        ...actual,
        DynamoDBClient: vi.fn(function DynamoDBClient() {
          return { send };
        }),
      };
    });

    const { requestOAuthLock } = await import("../dynamo-store");
    const result = requestOAuthLock("same-session", async () => "acquired");

    await vi.advanceTimersByTimeAsync(250);

    await expect(result).resolves.toBe("acquired");
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("stores protected resource metadata fallback for one hour", async () => {
    const { DynamoOAuthStore } = await import("../dynamo-store");
    const { OAUTH_METADATA_TTL_SECONDS } = await import("../constants");
    expect(OAUTH_METADATA_TTL_SECONDS).toBe(60 * 60);
    const store = new DynamoOAuthStore<string, { resource: string; authorization_servers: [string] }>("pr-metadata");

    await store.set("https://morel.us-east.host.bsky.network", {
      resource: "https://morel.us-east.host.bsky.network",
      authorization_servers: ["https://bsky.social"],
    });

    await expect(store.get("https://morel.us-east.host.bsky.network")).resolves.toEqual({
      resource: "https://morel.us-east.host.bsky.network",
      authorization_servers: ["https://bsky.social"],
    });

    await vi.advanceTimersByTimeAsync((OAUTH_METADATA_TTL_SECONDS * 1000) + 1_000);
    await expect(store.get("https://morel.us-east.host.bsky.network")).resolves.toBeUndefined();
  });

  it('uses strong reads and checks browser-session TTL before Dynamo deletes the item', async () => {
    vi.stubEnv('USE_AWS_REAL_DB', 'true');
    vi.stubEnv('OAUTH_STORE_TABLE_NAME', 'oauth-store');
    const send = vi.fn().mockResolvedValue({ Item: {
      value: { S: JSON.stringify({ did: 'did:plc:test' }) },
      expiresAt: { N: String(Math.floor(Date.now() / 1000)) },
    } });
    vi.doMock('@aws-sdk/client-dynamodb', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@aws-sdk/client-dynamodb')>();
      return { ...actual, DynamoDBClient: vi.fn(function () { return { send }; }) };
    });
    const { DynamoOAuthStore } = await import('../dynamo-store');
    const store = new DynamoOAuthStore<string, unknown>('browser-session');
    expect(await store.get('session-id')).toBeUndefined();
    expect(send.mock.calls[0][0].input.ConsistentRead).toBe(true);
    const account = new DynamoOAuthStore<string, unknown>('browser-account');
    await account.set('did:plc:test', { legacyAllowed: false });
    expect(send.mock.calls[1][0].input.Item.expiresAt).toBeUndefined();
  });

  it('conditionally deletes only the expected browser session owner', async () => {
    const { DynamoOAuthStore } = await import('../dynamo-store');
    const store = new DynamoOAuthStore<string, { version: number }>('browser-session');
    await store.set('id', { version: 2 }, 'owner-2');
    expect(await store.deleteIfOwner('id', 'owner-1')).toBe(false);
    expect(await store.get('id')).toEqual({ version: 2 });
    expect(await store.deleteIfOwner('id', 'owner-2')).toBe(true);
    expect(await store.get('id')).toBeUndefined();
  });

  it('fences stale generation writes and never reopens a revoked account', async () => {
    const { DynamoOAuthStore } = await import('../dynamo-store');
    const store = new DynamoOAuthStore<string, { legacyAllowed: boolean }>('browser-account');
    expect(await store.setIfOwner('did:plc:test', { legacyAllowed: true }, 'generation-1')).toBe(true);
    expect(await store.setIfOwner('did:plc:test', { legacyAllowed: false }, 'generation-2', 'generation-1')).toBe(true);
    expect(await store.setIfOwner('did:plc:test', { legacyAllowed: true }, 'stale-generation')).toBe(false);
    expect(await store.setIfOwner('did:plc:test', { legacyAllowed: true }, 'stale-generation', 'generation-1')).toBe(false);
    expect(await store.get('did:plc:test')).toEqual({ legacyAllowed: false });
  });
});
