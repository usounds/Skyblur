// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { MantineProvider } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { PostComposerState, SavePlan } from "@/types/postComposer";
import { PostComposerScreen, shouldConfirmComposerBack } from "../PostComposerScreen";

vi.mock("@/state/Locale", () => ({
  useLocale: () => ({
    localeData: {
      CreatePost_ConfirmBackDescription: "Discard your changes?",
      CreatePost_ConfirmBackTitle: "Confirm",
      CreatePost_OmmitChar: "*",
      CreatePost_UpdateButton: "Update",
      DeleteList_CancelButton: "Cancel",
      Menu_Back: "Back",
      PostComposer_ActionBack: "Back",
      PostComposer_ActionNext: "Next",
      PostComposer_ActionSubmit: "Post",
      PostComposer_ErrorSaveFailed: "Save failed.",
      PostComposer_ErrorTextRequired: "Text is required.",
      PostComposer_ErrorUnsupportedStorageChange: "Unsupported storage change.",
      PostComposer_SaveSuccess: "Saved.",
      PostComposer_StepAudience: "Audience",
      PostComposer_StepCheck: "Check",
      PostComposer_StepWrite: "Write",
    },
  }),
}));

vi.mock("@mantine/notifications", () => ({
  notifications: {
    show: vi.fn(),
  },
}));

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

function renderScreen(props: Partial<Parameters<typeof PostComposerScreen>[0]> = {}) {
  const renderStep = props.renderStep ?? (({ state, setState }: { state: PostComposerState; setState: (patch: Partial<PostComposerState>) => void }) => (
    <div>
      <p>{state.step}</p>
      <p>{state.dirty ? "dirty" : "clean"}</p>
      <button type="button" onClick={() => setState({ text: "changed text" })}>Make dirty</button>
    </div>
  ));

  render(
    <MantineProvider>
      <PostComposerScreen
        initialData={{
          mode: "create",
          authorDid: "did:plc:abc",
          text: "ready [secret]",
          visibility: "public",
          ...props.initialData,
        }}
        buildSavePlan={props.buildSavePlan ?? (() => ({ ok: true, plan: { kind: "create-public" } as SavePlan }))}
        onSubmit={props.onSubmit}
        onBack={props.onBack}
        renderStep={renderStep}
        requiresRelogin={props.requiresRelogin}
      />
    </MantineProvider>,
  );
}

describe("PostComposerScreen component behavior", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("asks for confirmation before leaving a create form with content", async () => {
    const onBack = vi.fn();
    renderScreen({ onBack });

    await userEvent.click(screen.getAllByRole("button", { name: "Back" })[0]!);

    expect(await screen.findByText("Discard your changes?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel", hidden: true }));
    expect(onBack).not.toHaveBeenCalled();

    await userEvent.click(screen.getAllByRole("button", { name: "Back" })[0]!);
    expect(await screen.findByText("Discard your changes?")).toBeInTheDocument();
    const backButtons = screen.getAllByRole("button", { name: "Back", hidden: true });
    fireEvent.click(backButtons[backButtons.length - 1]!);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("asks for confirmation before leaving an edit form", async () => {
    const onBack = vi.fn();
    renderScreen({
      initialData: {
        mode: "edit",
        authorDid: "did:plc:abc",
        text: "existing [secret]",
        visibility: "public",
      },
      onBack,
    });

    await userEvent.click(screen.getAllByRole("button", { name: "Back" })[0]!);

    expect(await screen.findByText("Discard your changes?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel", hidden: true }));
    expect(onBack).not.toHaveBeenCalled();

    await userEvent.click(screen.getAllByRole("button", { name: "Back" })[0]!);
    expect(await screen.findByText("Discard your changes?")).toBeInTheDocument();
    const backButtons = screen.getAllByRole("button", { name: "Back", hidden: true });
    fireEvent.click(backButtons[backButtons.length - 1]!);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("does not ask for confirmation before leaving an empty create form", async () => {
    const onBack = vi.fn();
    renderScreen({
      initialData: {
        mode: "create",
        authorDid: "did:plc:abc",
        text: "",
        visibility: "public",
      },
      onBack,
    });

    await userEvent.click(screen.getAllByRole("button", { name: "Back" })[0]!);

    expect(screen.queryByText("Discard your changes?")).not.toBeInTheDocument();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("detects composer content that should confirm before leaving", () => {
    const state: PostComposerState = {
      mode: "create",
      step: "write",
      text: "",
      textForRecord: "",
      textForBluesky: "",
      blurredText: "",
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

    expect(shouldConfirmComposerBack(state)).toBe(false);
    expect(shouldConfirmComposerBack({ ...state, text: "draft" })).toBe(true);
    expect(shouldConfirmComposerBack({ ...state, mode: "edit", text: "existing" })).toBe(true);
    expect(shouldConfirmComposerBack({ ...state, dirty: true })).toBe(true);
    expect(shouldConfirmComposerBack({ ...state, postGate: { allowQuote: false } })).toBe(true);
  });

  it("shows inline submit failures without notifications", async () => {
    const onSubmit = vi.fn().mockResolvedValue({
      status: "error",
      messageKey: "PostComposer_ErrorSaveFailed",
    });
    renderScreen({ onSubmit });

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Post" }));

    expect(await screen.findByText("Save failed.")).toBeVisible();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(notifications.show).not.toHaveBeenCalled();
  });

  it("shows a success notification after saving", async () => {
    const onSubmit = vi.fn().mockResolvedValue({
      status: "success",
    });
    renderScreen({ onSubmit });

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Post" }));

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        id: "post-composer-save-success",
        color: "green",
        message: "Saved.",
      });
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
