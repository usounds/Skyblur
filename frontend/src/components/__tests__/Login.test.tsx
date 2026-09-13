// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthenticationTitle } from "../login/Login";
import { AtPassport } from "@atpassport/client";

const passportMocks = vi.hoisted(() => ({
  isHandleAssistSupported: vi.fn(() => true),
  requestHandleAssist: vi.fn(),
}));

vi.mock("@atpassport/client", () => {
  class MockAtPassport {
    isHandleAssistSupported = passportMocks.isHandleAssistSupported;
    requestHandleAssist = passportMocks.requestHandleAssist;
  }

  return {
    AtPassport: vi.fn(MockAtPassport),
    AtPassportIcon: () => null,
    AtPassportUI: {
      en: { title: "Login with @passport", description: "Handle input assist" },
      ja: { title: "@passportでログイン", description: "ハンドル入力アシスト" },
    },
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

  beforeEach(() => {
    passportMocks.isHandleAssistSupported.mockReturnValue(true);
    passportMocks.requestHandleAssist.mockReset();
  });

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

    passportMocks.requestHandleAssist.mockImplementation(async () => {
      return {
        did: "did:plc:test12345",
        username: "alice.bsky.social",
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

    const atPassportBtn = await screen.findByRole("button", { name: /@passport/i });
    await user.click(atPassportBtn);

    await waitFor(() => {
      expect(passportMocks.requestHandleAssist).toHaveBeenCalledTimes(1);
    });

    expect(AtPassport).toHaveBeenCalledWith(expect.objectContaining({
      baseUrl: "https://atpassport.net",
      fedcm: true,
    }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/oauth/login?handle=alice.bsky.social"),
        expect.any(Object),
      );
      expect(assignMock).toHaveBeenCalledWith("https://auth.bsky.social/oauth/authorize?test=1");
    });
  });

  it("uses the dev @passport origin on the dev Skyblur host", async () => {
    const user = userEvent.setup();

    delete (window as any).location;
    window.location = {
      ...originalLocation,
      origin: "https://dev.skyblur.uk",
      hostname: "dev.skyblur.uk",
      search: "",
      assign: vi.fn(),
    } as any;

    passportMocks.requestHandleAssist.mockResolvedValue(null);

    renderLogin();

    await user.click(screen.getByRole("checkbox"));
    await user.click(await screen.findByRole("button", { name: /@passport/i }));

    await waitFor(() => {
      expect(AtPassport).toHaveBeenCalledWith(expect.objectContaining({
        baseUrl: "https://dev.atpassport.net",
        fedcm: true,
      }));
      expect(passportMocks.requestHandleAssist).toHaveBeenCalledOnce();
    });
  });

  it("hides the complete @passport panel when FedCM is unsupported", async () => {
    passportMocks.isHandleAssistSupported.mockReturnValue(false);

    renderLogin();

    await waitFor(() => {
      expect(passportMocks.isHandleAssistSupported).toHaveBeenCalled();
    });
    expect(screen.queryByRole("button", { name: /@passport/i })).not.toBeInTheDocument();
    expect(screen.queryByText("ハンドル入力アシスト")).not.toBeInTheDocument();
    expect(passportMocks.requestHandleAssist).not.toHaveBeenCalled();
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

    passportMocks.requestHandleAssist.mockResolvedValue(null);

    renderLogin();

    const agreeCheckbox = screen.getByRole("checkbox");
    await user.click(agreeCheckbox);

    const atPassportBtn = await screen.findByRole("button", { name: /@passport/i });
    await user.click(atPassportBtn);

    await waitFor(() => {
      expect(atPassportBtn).not.toBeDisabled();
    });

    expect(assignMock).not.toHaveBeenCalled();
  });

  it("does not redirect when FedCM fails at runtime", async () => {
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

    passportMocks.requestHandleAssist.mockResolvedValue(null);

    renderLogin();

    const agreeCheckbox = screen.getByRole("checkbox");
    await user.click(agreeCheckbox);

    const atPassportBtn = await screen.findByRole("button", { name: /@passport/i });
    await user.click(atPassportBtn);

    await waitFor(() => {
      expect(passportMocks.requestHandleAssist).toHaveBeenCalledOnce();
    });
    expect(assignMock).not.toHaveBeenCalled();
  });

  it("disables the handle input while login is processing", async () => {
    const user = userEvent.setup();
    let resolveFetch: (value: any) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    globalThis.fetch = vi.fn().mockReturnValue(fetchPromise);

    renderLogin();

    const agreeCheckbox = screen.getByRole("checkbox");
    await user.click(agreeCheckbox);

    const handleInput = screen.getByRole("combobox");
    expect(handleInput).not.toBeDisabled();

    await user.type(handleInput, "alice.bsky.social");
    const loginButton = screen.getByRole("button", { name: /^ログイン$|^Login$/i });
    await user.click(loginButton);

    await waitFor(() => {
      expect(handleInput).toBeDisabled();
    });

    resolveFetch!({
      ok: true,
      json: async () => ({ url: "https://auth.bsky.social/oauth/authorize?test=1" }),
    });
  });
});
