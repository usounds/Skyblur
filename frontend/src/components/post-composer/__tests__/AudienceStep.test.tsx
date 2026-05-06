import { describe, expect, it } from "vitest";

import { getGateControlsEditable, getPasswordWhitespaceError, getVisibilityOutcomeCopy } from "../AudienceStep";
import type { PostComposerState } from "@/types/postComposer";
import { getPostTextWarning } from "../WriteStep";

describe("AudienceStep helpers", () => {
  it("detects ASCII and full-width whitespace in password values", () => {
    expect(getPasswordWhitespaceError("abc def")).toBe(true);
    expect(getPasswordWhitespaceError("abc　def")).toBe(true);
    expect(getPasswordWhitespaceError("abcdef")).toBe(false);
  });

  it("describes selected visibility as Bluesky and Skyblur outcomes", () => {
    const locale = {
      PostComposer_AudienceOutcomePublicBluesky: "public bsky",
      PostComposer_AudienceOutcomePublicSkyblur: "public skyblur",
      PostComposer_AudienceOutcomeLoginBluesky: "login bsky",
      PostComposer_AudienceOutcomeLoginSkyblur: "login skyblur",
      PostComposer_AudienceOutcomePasswordBluesky: "password bsky",
      PostComposer_AudienceOutcomePasswordSkyblur: "password skyblur",
      PostComposer_AudienceOutcomeFollowersBluesky: "followers bsky",
      PostComposer_AudienceOutcomeFollowersSkyblur: "followers skyblur",
      PostComposer_AudienceOutcomeFollowingBluesky: "following bsky",
      PostComposer_AudienceOutcomeFollowingSkyblur: "following skyblur",
      PostComposer_AudienceOutcomeMutualBluesky: "mutual bsky",
      PostComposer_AudienceOutcomeMutualSkyblur: "mutual skyblur",
      PostComposer_AudienceOutcomeListBluesky: "list bsky",
      PostComposer_AudienceOutcomeListSkyblur: "list skyblur",
    };

    expect(getVisibilityOutcomeCopy("public", locale)).toEqual({ bluesky: "public bsky", skyblur: "public skyblur" });
    expect(getVisibilityOutcomeCopy("password", locale)).toEqual({ bluesky: "password bsky", skyblur: "password skyblur" });
    expect(getVisibilityOutcomeCopy("list", locale)).toEqual({ bluesky: "list bsky", skyblur: "list skyblur" });
  });

  it("locks gate controls only for edit records whose gate data could not be initialized", () => {
    const state: PostComposerState = {
      mode: "edit",
      step: "audience",
      text: "hello",
      textForRecord: "hello",
      textForBluesky: "hello",
      blurredText: "hello",
      additional: "",
      simpleMode: false,
      limitConsecutive: false,
      visibility: "public",
      password: "",
      threadGate: [],
      postGate: { allowQuote: true },
      dirty: false,
      submitting: false,
    };

    expect(getGateControlsEditable(state, { mode: "edit", authorDid: "did:plc:abc", gateControlsEditable: false })).toBe(false);
    expect(getGateControlsEditable(state, { mode: "edit", authorDid: "did:plc:abc", gateControlsEditable: true })).toBe(true);
    expect(getGateControlsEditable({ ...state, mode: "create" }, { mode: "create", authorDid: "did:plc:abc", gateControlsEditable: false })).toBe(true);
  });
});

describe("WriteStep helpers", () => {
  it("maps bracket validation errors to existing CreatePost messages", () => {
    const locale = {
      CreatePost_ErrorDuplicateBranket: "duplicate",
      CreatePost_BracketsUnbalanced: "unbalanced",
      CreatePost_NotBracketInSimpleMode: "simple",
    };

    expect(getPostTextWarning("duplicate-or-unclosed-bracket", locale)).toBe("duplicate");
    expect(getPostTextWarning("unbalanced-bracket", locale)).toBe("unbalanced");
    expect(getPostTextWarning("bracket-in-simple-mode", locale)).toBe("simple");
    expect(getPostTextWarning(undefined, locale)).toBe("");
  });
});
