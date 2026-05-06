import { describe, expect, it } from "vitest";

import { createInitialComposerState, getStepError } from "../PostComposerScreen";

describe("PostComposerScreen helpers", () => {
  it("creates a create-mode default state with separate thread and post gates", () => {
    expect(createInitialComposerState()).toMatchObject({
      mode: "create",
      step: "write",
      visibility: "public",
      threadGate: [],
      postGate: { allowQuote: true },
      dirty: false,
      submitting: false,
    });
  });

  it("creates edit state from initial data", () => {
    expect(createInitialComposerState({
      mode: "edit",
      authorDid: "did:plc:abc",
      text: "existing",
      additional: "additional",
      visibility: "followers",
      threadGate: ["mention"],
      postGate: { allowQuote: false },
    })).toMatchObject({
      mode: "edit",
      text: "existing",
      additional: "additional",
      visibility: "followers",
      threadGate: ["mention"],
      postGate: { allowQuote: false },
    });
  });

  it("blocks write step when text is empty", () => {
    const state = createInitialComposerState();

    expect(getStepError(state, "write")).toMatchObject({
      step: "write",
      field: "text",
    });
  });

  it("blocks write step when text has bracket validation errors", () => {
    expect(getStepError({ ...createInitialComposerState(), text: "[" }, "write")).toMatchObject({
      step: "write",
      field: "text",
      messageKey: "CreatePost_ErrorDuplicateBranket",
    });
    expect(getStepError({ ...createInitialComposerState(), text: "secret]" }, "write")).toMatchObject({
      step: "write",
      field: "text",
      messageKey: "CreatePost_BracketsUnbalanced",
    });
  });

  it("blocks audience step for password without password, password spaces, and list without listUri", () => {
    expect(getStepError({ ...createInitialComposerState(), visibility: "password" }, "audience")).toMatchObject({
      field: "password",
    });
    expect(getStepError({ ...createInitialComposerState(), visibility: "password", password: "bad pass" }, "audience")).toMatchObject({
      field: "password",
      messageKey: "CreatePost_PasswordErrorSpace",
    });
    expect(getStepError({ ...createInitialComposerState(), visibility: "list" }, "audience")).toMatchObject({
      field: "listUri",
    });
  });
});
