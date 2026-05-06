import { describe, expect, it } from "vitest";

import {
  applyPasswordUnlockToInitialData,
  buildEditInitialData,
  getRestrictedEditErrorMessage,
  isMissingGateRecordResponse,
  loadGateInitialData,
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
    expect(validateEditableRecord(undefined)).toMatchObject({
      ok: false,
      reason: "invalid-record-type",
    });
    expect(validateEditableRecord({ ...baseRecord, $type: "app.bsky.feed.post" })).toMatchObject({
      ok: false,
      reason: "invalid-record-type",
    });
    expect(validateEditableRecord({ ...baseRecord, visibility: "friends" })).toMatchObject({
      ok: false,
      reason: "invalid-visibility",
    });
    expect(validateEditableRecord({ ...baseRecord, text: null })).toMatchObject({
      ok: false,
      reason: "invalid-text",
    });
    expect(validateEditableRecord(baseRecord)).toMatchObject({
      ok: true,
      visibility: "public",
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
    expect(normalizeEncryptCid({ ...baseRecord, visibility: "password", encryptBody: { ref: "bafy-ref" } } as any)).toBe("bafy-ref");
    expect(normalizeEncryptCid({ ...baseRecord, visibility: "password", encryptBody: { cid: "bafy-cid" } } as any)).toBe("bafy-cid");
    expect(normalizeEncryptCid({ ...baseRecord, visibility: "password", encryptBody: { $link: "bafy-top-link" } } as any)).toBe("bafy-top-link");
    expect(normalizeEncryptCid({ ...baseRecord, visibility: "password", encryptBody: {} } as any)).toBe("");
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

  it("falls back to editable default gate state when gate records are absent", () => {
    expect(parseThreadGateRecord(undefined)).toEqual({
      recordExists: false,
      threadGate: [],
    });
    expect(parseThreadGateRecord({
      $type: "app.bsky.feed.threadgate",
      allow: [{ $type: "unknown" }, {}],
    })).toEqual({
      recordExists: true,
      threadGate: [],
    });
    expect(parsePostGateRecord(undefined)).toEqual({
      recordExists: false,
      postGate: { allowQuote: true },
    });
    expect(parsePostGateRecord({
      $type: "app.bsky.feed.postgate",
      embeddingRules: [{ $type: "unknown" }],
    })).toEqual({
      recordExists: true,
      postGate: { allowQuote: true },
    });
  });

  it("loads gate initial data and locks controls only for non-404 failures", async () => {
    const calls: Array<{ collection: string; rkey: string }> = [];
    const agent = {
      get: async (_method: string, input: { params: { collection: string; rkey: string } }) => {
        calls.push({ collection: input.params.collection, rkey: input.params.rkey });
        if (input.params.collection === "app.bsky.feed.threadgate") {
          return {
            ok: true,
            data: {
              value: {
                $type: "app.bsky.feed.threadgate",
                allow: [{ $type: "app.bsky.feed.threadgate#mentionRule" }],
              },
            },
          };
        }
        return { ok: false, status: 500 };
      },
    };

    await expect(loadGateInitialData(agent, "did:plc:abc", "3abc")).resolves.toEqual({
      threadGate: ["mention"],
      postGate: { allowQuote: true },
      threadGateRecordExists: true,
      postGateRecordExists: false,
      gateControlsEditable: false,
    });
    expect(calls).toEqual([
      { collection: "app.bsky.feed.threadgate", rkey: "3abc" },
      { collection: "app.bsky.feed.postgate", rkey: "3abc" },
    ]);
  });

  it("treats missing gate records as editable", async () => {
    const agent = {
      get: async () => ({ ok: false, status: 400, data: { error: "RecordNotFound" } }),
    };

    await expect(loadGateInitialData(agent, "did:plc:abc", "3abc")).resolves.toMatchObject({
      threadGate: [],
      postGate: { allowQuote: true },
      threadGateRecordExists: false,
      postGateRecordExists: false,
      gateControlsEditable: true,
    });
  });

  it("recognizes both HTTP 404 and AT Protocol RecordNotFound as missing gate records", () => {
    expect(isMissingGateRecordResponse({ ok: false, status: 404 })).toBe(true);
    expect(isMissingGateRecordResponse({ ok: false, status: 400, data: { error: "RecordNotFound" } })).toBe(true);
    expect(isMissingGateRecordResponse({ ok: false, status: 400, data: { error: "InvalidRequest" } })).toBe(false);
    expect(isMissingGateRecordResponse({ ok: false, status: 500, data: { error: "RecordNotFound" } })).toBe(false);
  });

  it("maps restricted edit error codes to user-facing messages", () => {
    const locale = {
      Post_Restricted_NotAuthorized_Followers: "followers",
      Post_Restricted_NotAuthorized_Following: "following",
      Post_Restricted_NotAuthorized_Mutual: "mutual",
      Post_Restricted_LoginRequired: "login",
      Post_Restricted_ContentMissing: "missing",
      Post_Restricted_NotAuthorized_List: "list",
      Post_Restricted_ListCheckFailed: "list-check",
      Post_Restricted_NotAuthorized: "fallback",
    };

    expect(getRestrictedEditErrorMessage("NotFollower", locale)).toBe("followers");
    expect(getRestrictedEditErrorMessage("NotFollowing", locale)).toBe("following");
    expect(getRestrictedEditErrorMessage("NotMutual", locale)).toBe("mutual");
    expect(getRestrictedEditErrorMessage("AuthRequired", locale)).toBe("login");
    expect(getRestrictedEditErrorMessage("ContentMissing", locale)).toBe("missing");
    expect(getRestrictedEditErrorMessage("NotListMember", locale)).toBe("list");
    expect(getRestrictedEditErrorMessage("ListMembershipCheckFailed", locale)).toBe("list-check");
    expect(getRestrictedEditErrorMessage("Other", locale)).toBe("fallback");
  });
});
