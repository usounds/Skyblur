// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { MantineProvider } from "@mantine/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import LanguageToggle from "../LanguageToggle";
import { useComposerLocaleSwitchGuardStore } from "@/state/ComposerLocaleSwitchGuard";
import { useLocaleStore } from "@/state/Locale";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({
      matches: false,
      media: "",
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

afterEach(() => {
  useLocaleStore.getState().setLocale("ja");
  useComposerLocaleSwitchGuardStore.getState().clearHasUnsavedComposerChanges();
  vi.restoreAllMocks();
});

function renderToggle() {
  return render(
    <MantineProvider>
      <LanguageToggle />
    </MantineProvider>,
  );
}

describe("LanguageToggle", () => {
  it("switches immediately when there is no unsaved composer state", async () => {
    const user = userEvent.setup();
    renderToggle();

    await user.click(screen.getAllByRole("button", { name: "Toggle language" })[0]!);

    expect(useLocaleStore.getState().locale).toBe("en");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a modal before switching when composer input is dirty", async () => {
    const user = userEvent.setup();
    useComposerLocaleSwitchGuardStore.getState().setHasUnsavedComposerChanges(true);
    renderToggle();

    await user.click(screen.getAllByRole("button", { name: "Toggle language" })[0]!);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("言語を切り替えますか？")).toBeInTheDocument();
    expect(useLocaleStore.getState().locale).toBe("ja");

    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(useLocaleStore.getState().locale).toBe("ja");

    await user.click(screen.getAllByRole("button", { name: "Toggle language" })[0]!);
    const proceedButton = await screen.findByText("切り替える");
    await user.click(proceedButton);
    expect(useLocaleStore.getState().locale).toBe("en");
  });
});
