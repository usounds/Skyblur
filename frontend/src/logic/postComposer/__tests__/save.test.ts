import { describe, expect, it, vi } from "vitest";

import { buildPostComposerSavePlan, postComposerSave } from "../save";
import type { PostComposerState } from "@/types/postComposer";
import type { PostView } from "@/types/types";
import type { ResourceUri } from "@atcute/lexicons/syntax";

vi.mock("@atcute/tid", () => ({
  now: () => "3test-rkey",
}));

vi.mock("@/logic/IdentityResolver", () => ({
  IdentityResolver: {
    resolve: vi.fn(async (handle: string) => ({ did: `did:plc:${handle.replace(/[^a-zA-Z0-9]/g, "")}` })),
  },
}));

const baseState: PostComposerState = {
  mode: "create",
  step: "check",
  text: "hello [secret]",
  textForRecord: "hello [secret]",
  textForBluesky: "hello ○○○○○○",
  blurredText: "hello ○○○○○○",
  additional: "additional",
  simpleMode: false,
  limitConsecutive: false,
  visibility: "public",
  password: "",
  threadGate: [],
  postGate: { allowQuote: true },
  dirty: true,
  submitting: false,
};

describe("buildPostComposerSavePlan", () => {
  it("builds create-public for public/login record storage", () => {
    expect(buildPostComposerSavePlan(baseState)).toMatchObject({
      kind: "create-public",
      toVisibility: "public",
      toStorageFormat: "public-record",
      updatesBlueskyPostBody: false,
    });
    expect(buildPostComposerSavePlan({ ...baseState, visibility: "login" })).toMatchObject({
      kind: "create-public",
      toVisibility: "login",
      toStorageFormat: "public-record",
    });
  });

  it("builds password and restricted create plans with separate write targets", () => {
    expect(buildPostComposerSavePlan({ ...baseState, visibility: "password", password: "pw" })).toMatchObject({
      kind: "create-password",
      toStorageFormat: "password-blob",
      requiresPasswordInput: true,
      writeTargets: expect.arrayContaining(["upload-password-blob"]),
    });
    expect(buildPostComposerSavePlan({ ...baseState, visibility: "followers" })).toMatchObject({
      kind: "create-restricted",
      toStorageFormat: "restricted-store",
      writeTargets: expect.arrayContaining(["store-restricted-content"]),
    });
  });

  it("keeps threadGate and postGate as independent save targets", () => {
    expect(buildPostComposerSavePlan({
      ...baseState,
      threadGate: ["mention"],
      postGate: { allowQuote: false },
    })).toMatchObject({
      writeTargets: expect.arrayContaining(["create-threadgate", "create-postgate"]),
      threadGate: ["mention"],
      postGate: { allowQuote: false },
    });
  });

  it("allows non-password visibility changes while editing", () => {
    expect(buildPostComposerSavePlan({ ...baseState, mode: "edit", visibility: "followers" }, {
      mode: "edit",
      authorDid: "did:plc:abc",
      originalVisibility: "followers",
      originalStorageFormat: "restricted-store",
    })).toMatchObject({
      kind: "update-same-storage",
      fromStorageFormat: "restricted-store",
      toStorageFormat: "restricted-store",
    });

    expect(buildPostComposerSavePlan({ ...baseState, mode: "edit", visibility: "followers" }, {
      mode: "edit",
      authorDid: "did:plc:abc",
      originalVisibility: "public",
      originalStorageFormat: "public-record",
    })).toMatchObject({
      kind: "update-same-storage",
      fromStorageFormat: "public-record",
      toStorageFormat: "restricted-store",
      writeTargets: expect.arrayContaining(["store-restricted-content"]),
    });

    expect(buildPostComposerSavePlan({ ...baseState, mode: "edit", visibility: "login" }, {
      mode: "edit",
      authorDid: "did:plc:abc",
      originalVisibility: "mutual",
      originalStorageFormat: "restricted-store",
    })).toMatchObject({
      kind: "update-same-storage",
      fromStorageFormat: "restricted-store",
      toStorageFormat: "public-record",
    });
  });

  it("rejects password/non-password visibility changes while editing", () => {
    expect(buildPostComposerSavePlan({ ...baseState, mode: "edit", visibility: "password" }, {
      mode: "edit",
      authorDid: "did:plc:abc",
      originalVisibility: "public",
      originalStorageFormat: "public-record",
    })).toEqual({ error: "unsupported-storage-change" });

    expect(buildPostComposerSavePlan({ ...baseState, mode: "edit", visibility: "public" }, {
      mode: "edit",
      authorDid: "did:plc:abc",
      originalVisibility: "password",
      originalStorageFormat: "password-blob",
    })).toEqual({ error: "unsupported-storage-change" });
  });
});

describe("postComposerSave", () => {
  it("creates the same public applyWrites shape as CreatePost", async () => {
    const state: PostComposerState = {
      ...baseState,
      text: "本文[伏せたい文字]",
      textForRecord: "本文[伏せたい文字]",
      textForBluesky: "本文○○○○○",
      blurredText: "本文○○○○○",
      additional: "Blueskyには反映されずSkyblurでのみ表示されます",
      visibility: "public",
    };
    const plan = buildPostComposerSavePlan(state);
    if ("error" in plan) throw new Error("unexpected plan error");
    const agent = {
      post: vi.fn().mockResolvedValue({ ok: true, data: { commit: { cid: "bafy-commit" } } }),
    };

    const result = await postComposerSave({
      state,
      plan,
      did: "did:plc:example",
      agent,
      apiProxyAgent: {},
      locale: {
        CreatePost_Lang: "ja",
        CreatePost_OGPTitle: "Skyblur",
        CreatePost_OGPDescription: "伏せていない投稿を参照する。",
        CreatePost_OGPDescriptionPassword: "パスワードが必要です。",
      },
    });

    expect(result.status).toBe("success");
    expect(agent.post).toHaveBeenCalledWith("com.atproto.repo.applyWrites", {
      input: {
        repo: "did:plc:example",
        writes: [
          expect.objectContaining({
            $type: "com.atproto.repo.applyWrites#create",
            collection: "app.bsky.feed.post",
            rkey: "3test-rkey",
            value: expect.objectContaining({
              $type: "app.bsky.feed.post",
              text: "本文○○○○○",
              via: "Skyblur",
              "uk.skyblur.post.uri": "at://did:plc:example/uk.skyblur.post/3test-rkey",
              "uk.skyblur.post.visibility": "public",
              embed: {
                $type: "app.bsky.embed.external",
                external: {
                  uri: "https://skyblur.uk/post/did:plc:example/3test-rkey",
                  title: "Skyblur",
                  description: "伏せていない投稿を参照する。",
                },
              },
            }),
          }),
          {
            $type: "com.atproto.repo.applyWrites#create",
            collection: "uk.skyblur.post",
            rkey: "3test-rkey",
            value: {
              uri: "at://did:plc:example/app.bsky.feed.post/3test-rkey",
              text: "本文[伏せたい文字]",
              additional: "Blueskyには反映されずSkyblurでのみ表示されます",
              createdAt: expect.any(String),
              visibility: "public",
            },
          },
        ],
      },
    });
  });

  it("adds hashtag, mention, and URL facets to the Bluesky post", async () => {
    const state: PostComposerState = {
      ...baseState,
      text: "hello @alice.test #タグ https://example.com",
      textForRecord: "hello @alice.test #タグ https://example.com",
      textForBluesky: "hello @alice.test #タグ https://example.com",
      blurredText: "hello @alice.test #タグ https://example.com",
      additional: "",
    };
    const plan = buildPostComposerSavePlan(state);
    if ("error" in plan) throw new Error("unexpected plan error");
    const agent = {
      post: vi.fn().mockResolvedValue({ ok: true, data: { commit: { cid: "bafy-commit" } } }),
    };

    await postComposerSave({
      state,
      plan,
      did: "did:plc:example",
      agent,
      apiProxyAgent: {},
      locale: { CreatePost_Lang: "ja" },
    });

    const writes = agent.post.mock.calls[0][1].input.writes;
    const facets = writes[0].value.facets;
    expect(facets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        features: [expect.objectContaining({ $type: "app.bsky.richtext.facet#mention", did: "did:plc:alicetest" })],
      }),
      expect.objectContaining({
        features: [expect.objectContaining({ $type: "app.bsky.richtext.facet#tag", tag: "タグ" })],
      }),
      expect.objectContaining({
        features: [expect.objectContaining({ $type: "app.bsky.richtext.facet#link", uri: "https://example.com" })],
      }),
    ]));
  });

  it("creates password payloads without leaking plaintext into records", async () => {
    const state: PostComposerState = {
      ...baseState,
      visibility: "password",
      password: "pw",
      text: "本文[秘密]",
      textForRecord: "本文[秘密]",
      textForBluesky: "本文○○",
      blurredText: "本文○○",
      additional: "password additional",
    };
    const plan = buildPostComposerSavePlan(state);
    if ("error" in plan) throw new Error("unexpected plan error");
    const agent = {
      post: vi.fn()
        .mockResolvedValueOnce({ ok: true, data: { blob: { ref: { $link: "bafy-encrypted" }, mimeType: "text/plain", size: 12 } } })
        .mockResolvedValueOnce({ ok: true, data: { commit: { cid: "bafy-commit" } } }),
    };
    const apiProxyAgent = {
      post: vi.fn().mockResolvedValue({ ok: true, data: { body: "encrypted-body" } }),
    };

    await postComposerSave({
      state,
      plan,
      did: "did:plc:example",
      agent,
      apiProxyAgent,
      locale: {
        CreatePost_Lang: "ja",
        CreatePost_OGPDescription: "伏せていない投稿を参照する。",
        CreatePost_OGPDescriptionPassword: "パスワードが必要です。",
      },
    });

    expect(apiProxyAgent.post).toHaveBeenCalledWith("uk.skyblur.post.encrypt", {
      input: {
        body: JSON.stringify({ text: "本文[秘密]", additional: "password additional" }),
        password: "pw",
      },
      as: "json",
    });
    expect(agent.post.mock.calls[0]).toEqual([
      "com.atproto.repo.uploadBlob",
      expect.objectContaining({
        encoding: "binary",
        headers: { "Content-Type": "application/octet-stream" },
      }),
    ]);
    const writes = agent.post.mock.calls[1][1].input.writes;
    expect(writes[0].value.embed.external.description).toBe("伏せていない投稿を参照する。パスワードが必要です。");
    expect(writes[1]).toEqual(expect.objectContaining({
      collection: "uk.skyblur.post",
      value: expect.objectContaining({
        text: "本文○○",
        additional: "",
        encryptBody: { ref: { $link: "bafy-encrypted" }, mimeType: "text/plain", size: 12 },
        visibility: "password",
      }),
    }));
    expect(JSON.stringify(writes)).not.toContain("password additional");
    expect(JSON.stringify(writes)).not.toContain("本文[秘密]");
    expect(JSON.stringify(writes)).not.toContain('"pw"');
  });

  it("creates restricted list payloads through store before applyWrites", async () => {
    const state: PostComposerState = {
      ...baseState,
      visibility: "list",
      listUri: "at://did:plc:example/app.bsky.graph.list/3list" as ResourceUri,
      text: "本文[限定]",
      textForRecord: "本文[限定]",
      textForBluesky: "本文○○",
      blurredText: "本文○○",
      additional: "restricted additional",
    };
    const plan = buildPostComposerSavePlan(state);
    if ("error" in plan) throw new Error("unexpected plan error");
    const agent = {
      post: vi.fn().mockResolvedValue({ ok: true, data: { commit: { cid: "bafy-commit" } } }),
    };
    const apiProxyAgent = {
      post: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    };

    await postComposerSave({
      state,
      plan,
      did: "did:plc:example",
      agent,
      apiProxyAgent,
      locale: { CreatePost_Lang: "ja" },
    });

    expect(apiProxyAgent.post.mock.invocationCallOrder[0]).toBeLessThan(agent.post.mock.invocationCallOrder[0]);
    expect(apiProxyAgent.post).toHaveBeenCalledWith("uk.skyblur.post.store", {
      input: {
        uri: "at://did:plc:example/uk.skyblur.post/3test-rkey",
        text: "本文[限定]",
        additional: "restricted additional",
        visibility: "list",
        listUri: "at://did:plc:example/app.bsky.graph.list/3list",
      },
      as: "json",
    });
    const writes = agent.post.mock.calls[0][1].input.writes;
    expect(writes[1]).toEqual(expect.objectContaining({
      collection: "uk.skyblur.post",
      value: expect.objectContaining({
        text: "本文○○",
        visibility: "list",
        listUri: "at://did:plc:example/app.bsky.graph.list/3list",
      }),
    }));
    expect(JSON.stringify(writes)).not.toContain("restricted additional");
    expect(JSON.stringify(writes)).not.toContain("本文[限定]");
    expect(JSON.stringify(writes)).not.toContain("encryptBody");
  });

  it("creates reply refs from the selected reply target", async () => {
    const replyPost: PostView = {
      uri: "at://did:plc:other/app.bsky.feed.post/3parent",
      cid: "bafy-parent",
      author: { did: "did:plc:other", handle: "other.test", displayName: "Other" },
      record: {
        text: "parent",
        createdAt: "2026-01-01T00:00:00.000Z",
        reply: {
          root: {
            uri: "at://did:plc:root/app.bsky.feed.post/3root",
            cid: "bafy-root",
          },
          parent: {
            uri: "at://did:plc:old/app.bsky.feed.post/3old",
            cid: "bafy-old-parent",
          },
        },
      },
      indexedAt: "2026-01-01T00:00:00.000Z",
    };
    const state: PostComposerState = {
      ...baseState,
      replyPost,
    };
    const plan = buildPostComposerSavePlan(state);
    if ("error" in plan) throw new Error("unexpected plan error");
    const agent = {
      post: vi.fn().mockResolvedValue({ ok: true, data: { commit: { cid: "bafy-commit" } } }),
    };

    await postComposerSave({
      state,
      plan,
      did: "did:plc:example",
      agent,
      apiProxyAgent: {},
      locale: { CreatePost_Lang: "ja" },
    });

    expect(agent.post.mock.calls[0][1].input.writes[0].value.reply).toEqual({
      $type: "app.bsky.feed.post#replyRef",
      root: {
        $type: "com.atproto.repo.strongRef",
        uri: "at://did:plc:root/app.bsky.feed.post/3root",
        cid: "bafy-root",
      },
      parent: {
        $type: "com.atproto.repo.strongRef",
        uri: "at://did:plc:other/app.bsky.feed.post/3parent",
        cid: "bafy-parent",
      },
    });
  });

  it("creates threadgate and postgate records for new posts when selected", async () => {
    const state: PostComposerState = {
      ...baseState,
      threadGate: ["mention", "following", "followers"],
      postGate: { allowQuote: false },
    };
    const plan = buildPostComposerSavePlan(state);
    if ("error" in plan) throw new Error("unexpected plan error");
    const agent = {
      post: vi.fn().mockResolvedValue({ ok: true, data: { commit: { cid: "bafy-commit" } } }),
    };

    await postComposerSave({
      state,
      plan,
      did: "did:plc:example",
      agent,
      apiProxyAgent: {},
      locale: { CreatePost_Lang: "ja" },
    });

    const writes = agent.post.mock.calls[0][1].input.writes;
    expect(writes[2]).toEqual(expect.objectContaining({
      $type: "com.atproto.repo.applyWrites#create",
      collection: "app.bsky.feed.threadgate",
      rkey: "3test-rkey",
      value: expect.objectContaining({
        post: "at://did:plc:example/app.bsky.feed.post/3test-rkey",
        allow: [
          { $type: "app.bsky.feed.threadgate#mentionRule" },
          { $type: "app.bsky.feed.threadgate#followingRule" },
          { $type: "app.bsky.feed.threadgate#followerRule" },
        ],
      }),
    }));
    expect(writes[3]).toEqual(expect.objectContaining({
      $type: "com.atproto.repo.applyWrites#create",
      collection: "app.bsky.feed.postgate",
      rkey: "3test-rkey",
      value: expect.objectContaining({
        post: "at://did:plc:example/app.bsky.feed.post/3test-rkey",
        embeddingRules: [{ $type: "app.bsky.feed.postgate#disableRule" }],
      }),
    }));
  });

  it("cleans up restricted storage after changing an edited post to non-restricted visibility", async () => {
    const state: PostComposerState = {
      ...baseState,
      mode: "edit",
      visibility: "public",
    };
    const initialData = {
      mode: "edit" as const,
      authorDid: "did:plc:example",
      blurUri: "at://did:plc:example/uk.skyblur.post/3edit-rkey",
      blurCid: "bafy-old",
      originalVisibility: "followers" as const,
      originalStorageFormat: "restricted-store" as const,
      record: {
        $type: "uk.skyblur.post" as const,
        uri: "at://did:plc:example/app.bsky.feed.post/3edit-rkey" as ResourceUri,
        text: "old ○○○○○○",
        createdAt: "2026-01-01T00:00:00.000Z",
        visibility: "followers" as const,
      },
    };
    const plan = buildPostComposerSavePlan(state, initialData);
    if ("error" in plan) throw new Error("unexpected plan error");
    const agent = {
      post: vi.fn().mockResolvedValue({ ok: true, data: { commit: { cid: "bafy-commit" } } }),
    };
    const apiProxyAgent = {
      post: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    };

    await postComposerSave({
      state,
      plan,
      did: "did:plc:example",
      agent,
      apiProxyAgent,
      locale: { CreatePost_Lang: "ja" },
      initialData,
    });

    const writes = agent.post.mock.calls[0][1].input.writes;
    expect(writes[0]).not.toHaveProperty("swapRecord");
    expect(agent.post).toHaveBeenCalledWith("com.atproto.repo.applyWrites", {
      input: {
        repo: "did:plc:example",
        writes: [
          expect.objectContaining({
            $type: "com.atproto.repo.applyWrites#update",
            collection: "uk.skyblur.post",
            rkey: "3edit-rkey",
            value: expect.objectContaining({
              text: "hello [secret]",
              additional: "additional",
              visibility: "public",
            }),
          }),
        ],
      },
    });
    expect(apiProxyAgent.post).toHaveBeenCalledWith("uk.skyblur.post.deleteStored", {
      input: {
        uri: "at://did:plc:example/uk.skyblur.post/3edit-rkey",
      },
    });
  });

  it("keeps restricted cleanup failure as a successful save warning", async () => {
    const state: PostComposerState = {
      ...baseState,
      mode: "edit",
      visibility: "login",
    };
    const initialData = {
      mode: "edit" as const,
      authorDid: "did:plc:example",
      blurUri: "at://did:plc:example/uk.skyblur.post/3edit-rkey",
      originalVisibility: "followers" as const,
      originalStorageFormat: "restricted-store" as const,
      record: {
        $type: "uk.skyblur.post" as const,
        uri: "at://did:plc:example/app.bsky.feed.post/3edit-rkey" as ResourceUri,
        text: "old ○○○○○○",
        createdAt: "2026-01-01T00:00:00.000Z",
        visibility: "followers" as const,
      },
    };
    const plan = buildPostComposerSavePlan(state, initialData);
    if ("error" in plan) throw new Error("unexpected plan error");
    const agent = {
      post: vi.fn().mockResolvedValue({ ok: true, data: { commit: { cid: "bafy-commit" } } }),
    };
    const apiProxyAgent = {
      post: vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    };

    const result = await postComposerSave({
      state,
      plan,
      did: "did:plc:example",
      agent,
      apiProxyAgent,
      locale: { CreatePost_Lang: "ja" },
      initialData,
    });

    expect(result).toMatchObject({
      status: "success",
      warning: {
        reason: "restricted-cleanup-failed",
        messageKey: "PostComposer_WarningRestrictedCleanupFailed",
      },
    });
  });

  it("saves edited threadgate and postgate separately from the Skyblur record", async () => {
    const state: PostComposerState = {
      ...baseState,
      mode: "edit",
      threadGate: ["mention"],
      postGate: { allowQuote: false },
    };
    const initialData = {
      mode: "edit" as const,
      authorDid: "did:plc:example",
      blurUri: "at://did:plc:example/uk.skyblur.post/3edit-rkey",
      blurCid: "bafy-old",
      originalVisibility: "public" as const,
      originalStorageFormat: "public-record" as const,
      record: {
        $type: "uk.skyblur.post" as const,
        uri: "at://did:plc:example/app.bsky.feed.post/3edit-rkey" as ResourceUri,
        text: "old",
        createdAt: "2026-01-01T00:00:00.000Z",
        visibility: "public" as const,
      },
      threadGate: [],
      postGate: { allowQuote: true },
      threadGateRecordExists: false,
      postGateRecordExists: false,
      gateControlsEditable: true,
    };
    const plan = buildPostComposerSavePlan(state, initialData);
    if ("error" in plan) throw new Error("unexpected plan error");
    const agent = {
      post: vi.fn().mockResolvedValue({ ok: true, data: { commit: { cid: "bafy-commit" } } }),
    };

    await postComposerSave({
      state,
      plan,
      did: "did:plc:example",
      agent,
      apiProxyAgent: {},
      locale: { CreatePost_Lang: "ja" },
      initialData,
    });

    expect(agent.post).toHaveBeenCalledTimes(2);
    expect(agent.post.mock.calls[0][1].input.writes).toEqual([
      expect.objectContaining({
        collection: "uk.skyblur.post",
      }),
    ]);
    expect(agent.post.mock.calls[1][1].input.writes).toEqual([
      expect.objectContaining({
        $type: "com.atproto.repo.applyWrites#create",
        collection: "app.bsky.feed.threadgate",
      }),
      expect.objectContaining({
        $type: "com.atproto.repo.applyWrites#create",
        collection: "app.bsky.feed.postgate",
      }),
    ]);
  });

  it("does not write unchanged edit gates and reports gate save partial failure separately", async () => {
    const state: PostComposerState = {
      ...baseState,
      mode: "edit",
      threadGate: ["mention"],
      postGate: { allowQuote: false },
    };
    const initialData = {
      mode: "edit" as const,
      authorDid: "did:plc:example",
      blurUri: "at://did:plc:example/uk.skyblur.post/3edit-rkey",
      blurCid: "bafy-old",
      originalVisibility: "public" as const,
      originalStorageFormat: "public-record" as const,
      record: {
        $type: "uk.skyblur.post" as const,
        uri: "at://did:plc:example/app.bsky.feed.post/3edit-rkey" as ResourceUri,
        text: "old",
        createdAt: "2026-01-01T00:00:00.000Z",
        visibility: "public" as const,
      },
      threadGate: [],
      postGate: { allowQuote: true },
      threadGateRecordExists: true,
      postGateRecordExists: true,
      gateControlsEditable: true,
    };
    const plan = buildPostComposerSavePlan(state, initialData);
    if ("error" in plan) throw new Error("unexpected plan error");
    const agent = {
      post: vi.fn()
        .mockResolvedValueOnce({ ok: true, data: { commit: { cid: "bafy-commit" } } })
        .mockResolvedValueOnce({ ok: false, status: 403 }),
    };

    const result = await postComposerSave({
      state,
      plan,
      did: "did:plc:example",
      agent,
      apiProxyAgent: {},
      locale: { CreatePost_Lang: "ja" },
      initialData,
    });

    expect(result).toMatchObject({
      status: "failed",
      reason: "threadgate-failed",
      retryable: false,
      messageKey: "PostComposer_ErrorGateSavePartial",
    });
    expect(agent.post.mock.calls[1][1].input.writes).toEqual([
      expect.objectContaining({
        $type: "com.atproto.repo.applyWrites#update",
        collection: "app.bsky.feed.threadgate",
      }),
      expect.objectContaining({
        $type: "com.atproto.repo.applyWrites#update",
        collection: "app.bsky.feed.postgate",
      }),
    ]);
  });
});
