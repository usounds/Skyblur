// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { AuthenticationTitle } from "../login/Login";
import { requestHandleAssist } from "@atpassport/client/core";

vi.mock("@atpassport/client/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@atpassport/client/core")>();
  return {
    ...actual,
    requestHandleAssist: vi.fn(),
  };
});

beforeAll(() => {
  class MockResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
  global.ResizeObserver = MockResizeObserver as any;

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

describe("AuthenticationTitle with FedCM support", () => {
  const originalLocation = window.location;

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    localStorage.clear();
  });

  function renderLogin(isModal = false) {
    return render(
      <MantineProvider>
        <Notifications />
        <AuthenticationTitle isModal={isModal} />
      </MantineProvider>,
    );
  }

  it("handles FedCM success by filling handle and proceeding with sign-in", async () => {
    const user = userEvent.setup();
    const assignMock = vi.fn();

    delete (window as any).location;
    window.location = {
      ...originalLocation,
      origin: "https://skyblur.uk",
      hostname: "skyblur.uk",
      search: "",
      assign: assignMock,
    } as any;

    vi.mocked(requestHandleAssist).mockImplementation(async () => {
      return {
        did: "did:plc:test12345",
        handle: "alice.bsky.social",
        token: "mock-token",
      };
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://auth.bsky.social/oauth/authorize?test=1" }),
    });
    globalThis.fetch = fetchMock;

    renderLogin();

    const agreeCheckbox = screen.getByRole("checkbox");
    await user.click(agreeCheckbox);

    const atPassportBtn = screen.getByRole("button", { name: /@passport/i });
    await user.click(atPassportBtn);

    await waitFor(() => {
      expect(requestHandleAssist).toHaveBeenCalledTimes(1);
    });

    const callArgs = vi.mocked(requestHandleAssist).mock.calls[0][0];
    expect(callArgs?.configURL).toBe("https://atpassport.net/fedcm/config.json");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/oauth/login?handle=alice.bsky.social"),
        expect.any(Object),
      );
      expect(assignMock).toHaveBeenCalledWith("https://auth.bsky.social/oauth/authorize?test=1");
    });
  });

  it("resets loading and leaves form intact when FedCM is dismissed by user", async () => {
    const user = userEvent.setup();
    const assignMock = vi.fn();

    delete (window as any).location;
    window.location = {
      ...originalLocation,
      origin: "https://skyblur.uk",
      hostname: "skyblur.uk",
      search: "",
      assign: assignMock,
    } as any;

    vi.mocked(requestHandleAssist).mockResolvedValue(null);

    renderLogin();

    const agreeCheckbox = screen.getByRole("checkbox");
    await user.click(agreeCheckbox);

    const atPassportBtn = screen.getByRole("button", { name: /@passport/i });
    await user.click(atPassportBtn);

    await waitFor(() => {
      expect(atPassportBtn).not.toBeDisabled();
    });

    expect(assignMock).not.toHaveBeenCalled();
  });

  it("executes fallback redirect when FedCM invokes fallback callback", async () => {
    const user = userEvent.setup();
    const assignMock = vi.fn();

    delete (window as any).location;
    window.location = {
      ...originalLocation,
      origin: "https://skyblur.uk",
      hostname: "skyblur.uk",
      search: "",
      assign: assignMock,
    } as any;

    vi.mocked(requestHandleAssist).mockImplementation(async (options) => {
      if (options?.fallback) {
        return await options.fallback();
      }
      return null;
    });

    renderLogin();

    const agreeCheckbox = screen.getByRole("checkbox");
    await user.click(agreeCheckbox);

    const atPassportBtn = screen.getByRole("button", { name: /@passport/i });
    await user.click(atPassportBtn);

    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith(
        expect.stringContaining("https://atpassport.net/"),
      );
    });
  });
});
