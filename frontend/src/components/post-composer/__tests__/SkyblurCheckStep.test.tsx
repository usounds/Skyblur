import { describe, expect, it } from "vitest";

import { buildReplyTargetLabel, buildSkyblurCheckSummary } from "@/logic/postComposer/skyblurCheck";
import type { PostComposerState, SavePlan } from "@/types/postComposer";

const state: PostComposerState = {
  mode: "edit",
  step: "check",
  text: "hello [secret]",
  textForRecord: "hello [secret]",
  textForBluesky: "hello ○○○○○○",
  blurredText: "hello ○○○○○○",
  additional: "additional",
  simpleMode: false,
  limitConsecutive: false,
  visibility: "followers",
  password: "",
  threadGate: ["mention"],
  postGate: { allowQuote: false },
  dirty: true,
  submitting: false,
};

const savePlan: SavePlan = {
  kind: "update-same-storage",
  mode: "edit",
  fromVisibility: "followers",
  toVisibility: "followers",
  fromStorageFormat: "restricted-store",
  toStorageFormat: "restricted-store",
  threadGate: ["mention"],
  postGate: { allowQuote: false },
  editableFields: ["text", "additional", "threadGate", "postGate"],
  writeTargets: ["update-skyblur-record", "update-threadgate", "update-postgate"],
  requiresPasswordInput: false,
  requiresPasswordUnlock: false,
  updatesBlueskyPostBody: false,
};

describe("buildSkyblurCheckSummary", () => {
  it("summarizes Bluesky and Skyblur text from real composer state", () => {
    expect(buildSkyblurCheckSummary(state, savePlan)).toMatchObject({
      blueskyText: "hello ○○○○○○",
      skyblurText: "hello [secret]",
      additionalText: "additional",
      visibility: "followers",
      threadGate: ["mention"],
      postGate: { allowQuote: false },
      updatesBlueskyPostBody: false,
    });
  });

  it("marks edit-time Bluesky body/card updates as out of MVP", () => {
    const summary = buildSkyblurCheckSummary(state, savePlan);

    expect(summary.unsupportedFields).toEqual(["blueskyPostBody", "blueskyEmbedCard"]);
    expect(summary.savePlan.kind).toBe("update-same-storage");
  });

  it("provides fix targets for missing password and list selection", () => {
    const passwordSummary = buildSkyblurCheckSummary({ ...state, visibility: "password", password: "" }, {
      ...savePlan,
      toVisibility: "password",
      toStorageFormat: "password-blob",
      fromStorageFormat: "password-blob",
    });
    const listSummary = buildSkyblurCheckSummary({ ...state, visibility: "list", listUri: undefined }, {
      ...savePlan,
      toVisibility: "list",
    });

    expect(passwordSummary.fixTargets).toContainEqual(expect.objectContaining({ field: "password" }));
    expect(listSummary.fixTargets).toContainEqual(expect.objectContaining({ field: "listUri" }));
  });

  it("summarizes reply target by post text instead of author handle", () => {
    const summary = buildSkyblurCheckSummary({
      ...state,
      replyPost: {
        uri: "at://did:example/app.bsky.feed.post/reply",
        cid: "reply-cid",
        author: { did: "did:plc:example", handle: "feed.usounds.work" },
        record: {
          text: "返信先の本文です",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        indexedAt: "2026-01-01T00:00:00.000Z",
      },
    }, savePlan);

    expect(summary.replyTarget).toBe("返信先の本文です");
  });

  it("limits reply target labels to 50 characters", () => {
    expect(buildReplyTargetLabel("a".repeat(51))).toBe(`${"a".repeat(50)}...`);
  });
});
