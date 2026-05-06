import { describe, expect, it } from "vitest";

import {
  applyPasswordUnlockToInitialData,
  buildEditInitialData,
  normalizeEditRouteParams,
  normalizeEncryptCid,
  parsePostGateRecord,
  parseThreadGateRecord,
  validateEditableRecord,
} from "../EditPostLoader";

const baseRecord = {
  $type: "uk.skyblur.post",
  text: "hello [secret]",
  additional: "additional",
  createdAt: "2026-05-06T00:00:00.000Z",
  uri: "at://did:plc:example/app.bsky.feed.post/abc",
  visibility: "public",
};

describe("EditPostLoader helpers", () => {
  it("validates edit route params before loading records", () => {
    expect(normalizeEditRouteParams("did:plc:abc", "3abc")).toMatchObject({
      ok: true,
      did: "did:plc:abc",
      rkey: "3abc",
    });
    expect(normalizeEditRouteParams("not-a-did", "3abc")).toMatchObject({ ok: false, reason: "invalid-did" });
    expect(normalizeEditRouteParams("did:plc:abc", "bad/rkey")).toMatchObject({ ok: false, reason: "invalid-rkey" });
  });

  it("rejects wrong collection type and unknown visibility", () => {
    expect(validateEditableRecord({ ...baseRecord, $type: "app.bsky.feed.post" })).toMatchObject({
      ok: false,
      reason: "invalid-record-type",
    });
    expect(validateEditableRecord({ ...baseRecord, visibility: "friends" })).toMatchObject({
      ok: false,
      reason: "invalid-visibility",
    });
  });

  it("builds edit initial data without changing Bluesky post body targets", () => {
    const initialData = buildEditInitialData({
      did: "did:plc:abc",
      rkey: "3abc",
      cid: "bafy123",
      record: {
        ...baseRecord,
        visibility: "followers",
      } as any,
      text: "unmasked",
      additional: "unmasked additional",
    });

    expect(initialData).toMatchObject({
      mode: "edit",
      authorDid: "did:plc:abc",
      originalVisibility: "followers",
      originalStorageFormat: "restricted-store",
      blurUri: "at://did:plc:abc/uk.skyblur.post/3abc",
      blurCid: "bafy123",
      text: "unmasked",
      additional: "unmasked additional",
      passwordUnlocked: true,
    });
  });

  it("normalizes legacy encrypt body cid shapes", () => {
    expect(normalizeEncryptCid({ ...baseRecord, visibility: "password", encryptBody: { ref: { $link: "bafy-link" } } } as any)).toBe("bafy-link");
    expect(normalizeEncryptCid({ ...baseRecord, visibility: "password", encryptBody: { cid: "bafy-cid" } } as any)).toBe("bafy-cid");
  });

  it("keeps the unlocked password in password edit initial data", () => {
    const initialData = buildEditInitialData({
      did: "did:plc:abc",
      rkey: "3abc",
      record: { ...baseRecord, visibility: "password" } as any,
    });

    expect(applyPasswordUnlockToInitialData(initialData, {
      text: "decrypted text",
      additional: "decrypted additional",
      password: "secret-pass",
    })).toMatchObject({
      text: "decrypted text",
      additional: "decrypted additional",
      password: "secret-pass",
      passwordUnlocked: true,
    });
  });

  it("parses existing Bluesky gate records into composer state", () => {
    expect(parseThreadGateRecord({
      $type: "app.bsky.feed.threadgate",
      allow: [
        { $type: "app.bsky.feed.threadgate#mentionRule" },
        { $type: "app.bsky.feed.threadgate#followingRule" },
        { $type: "app.bsky.feed.threadgate#followerRule" },
      ],
    })).toEqual({
      recordExists: true,
      threadGate: ["mention", "following", "followers"],
    });

    expect(parsePostGateRecord({
      $type: "app.bsky.feed.postgate",
      embeddingRules: [{ $type: "app.bsky.feed.postgate#disableRule" }],
    })).toEqual({
      recordExists: true,
      postGate: { allowQuote: false },
    });
  });
});
