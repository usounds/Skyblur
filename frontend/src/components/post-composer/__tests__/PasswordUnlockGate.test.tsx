// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { PasswordUnlockGate } from "../PasswordUnlockGate";

const setSensitiveDraft = vi.fn();

vi.mock("@/state/Locale", () => ({
  useLocale: () => ({
    localeData: {
      DeleteList_DecryptButton: "Unlock",
      DeleteList_DecryptErrorMessage: "Wrong password.",
      DeleteList_DecryptRequired: "Password is required.",
      PostComposer_PasswordUnlockDataMissing: "Password data is missing.",
      PostComposer_PasswordUnlockDescription: "Enter the password to edit this post.",
      PostComposer_PasswordUnlockTitle: "Edit password post",
      Post_Restricted_ContentMissing: "The encrypted content could not be found.",
      Post_Restricted_ListCheckFailed: "Could not decrypt the post.",
    },
  }),
}));

vi.mock("@/state/SensitiveDraft", () => ({
  useSensitiveDraftStore: (selector: (state: { setSensitiveDraft: typeof setSensitiveDraft }) => unknown) => selector({ setSensitiveDraft }),
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

function renderPasswordUnlockGate(onUnlocked = vi.fn()) {
  render(
    <MantineProvider>
      <PasswordUnlockGate did="did:plc:abc" encryptCid="bafy-encrypt" onUnlocked={onUnlocked} />
    </MantineProvider>,
  );
  return { onUnlocked };
}

describe("PasswordUnlockGate", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    setSensitiveDraft.mockClear();
  });

  it("shows a password error when decrypting is rejected", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 403,
    } as Response);

    renderPasswordUnlockGate();
    await userEvent.type(screen.getByPlaceholderText("p@ssw0rd"), "bad-pass");
    await userEvent.click(screen.getByRole("button", { name: "Unlock" }));

    expect(await screen.findByText("Wrong password.")).toBeVisible();
    expect(setSensitiveDraft).not.toHaveBeenCalled();
  });

  it("stores decrypted content and calls onUnlocked after successful decrypt", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        text: "Decrypted text",
        additional: "Decrypted additional",
      }),
    } as Response);
    const { onUnlocked } = renderPasswordUnlockGate();

    await userEvent.type(screen.getByPlaceholderText("p@ssw0rd"), "p@ssword");
    await userEvent.click(screen.getByRole("button", { name: "Unlock" }));

    expect(await screen.findByRole("button", { name: "Unlock" })).toBeEnabled();
    expect(globalThis.fetch).toHaveBeenCalledWith("/xrpc/uk.skyblur.post.decryptByCid", expect.objectContaining({
      body: JSON.stringify({
        repo: "did:plc:abc",
        cid: "bafy-encrypt",
        password: "p@ssword",
      }),
    }));
    expect(setSensitiveDraft).toHaveBeenCalledWith({
      text: "Decrypted text",
      additional: "Decrypted additional",
      password: "p@ssword",
      encryptKey: "p@ssword",
    });
    expect(onUnlocked).toHaveBeenCalledWith({
      text: "Decrypted text",
      additional: "Decrypted additional",
      password: "p@ssword",
      encryptKey: "p@ssword",
    });
  });
});
