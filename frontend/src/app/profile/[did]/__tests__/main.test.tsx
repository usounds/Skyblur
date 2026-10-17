// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfilePage } from "../main";

vi.mock("next/navigation", () => ({
  useParams: () => ({ did: "did:plc:testuser" }),
}));

vi.mock("next/head", () => ({
  default: ({ children }: any) => <>{children}</>,
}));

vi.mock("@atcute/client", () => ({
  Client: vi.fn(),
  simpleFetchHandler: vi.fn(),
}));

const mockGetPreference = vi.fn();
const mockResolvePdsEndpoint = vi.fn();

vi.mock("@/logic/HandleBluesky", () => ({
  getPreference: (...args: any[]) => mockGetPreference(...args),
  resolvePdsEndpoint: (...args: any[]) => mockResolvePdsEndpoint(...args),
}));

vi.mock("@/components/PostList", () => ({
  PostList: () => <div data-testid="post-list">Mocked PostList</div>,
}));

vi.mock("@/components/Avatar", () => ({
  Avatar: () => <div data-testid="avatar">Mocked Avatar</div>,
}));

vi.mock("@/state/Locale", () => ({
  useLocale: () => ({
    localeData: {
      Profile_NotPublish: "このユーザーのマイページは非公開です。",
    },
  }),
}));

vi.mock("@/state/XrpcAgent", () => ({
  useXrpcAgentStore: (selector: any) =>
    selector({
      publicAgent: {
        get: vi.fn().mockResolvedValue({
          ok: true,
          data: {
            did: "did:plc:testuser",
            handle: "testuser.bsky.social",
          },
        }),
      },
    }),
}));

import { MantineProvider } from "@mantine/core";

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

function renderWithProviders(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("should not render PostList and show not published message when isUseMyPage is false", async () => {
    mockGetPreference.mockResolvedValue({
      myPage: {
        isUseMyPage: false,
        description: "Private profile description",
      },
    });

    renderWithProviders(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("このユーザーのマイページは非公開です。")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("post-list")).not.toBeInTheDocument();
    expect(screen.queryByText("Private profile description")).not.toBeInTheDocument();
  });

  it("should render PostList and description when isUseMyPage is true", async () => {
    mockGetPreference.mockResolvedValue({
      myPage: {
        isUseMyPage: true,
        description: "Public profile description",
      },
    });
    mockResolvePdsEndpoint.mockResolvedValue("https://pds.example.com");

    renderWithProviders(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByTestId("post-list")).toBeInTheDocument();
    });

    expect(screen.getByText("Public profile description")).toBeInTheDocument();
    expect(screen.queryByText("このユーザーのマイページは非公開です。")).not.toBeInTheDocument();
  });
});
