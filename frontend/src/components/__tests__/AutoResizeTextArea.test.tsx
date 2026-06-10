// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import AutoResizeTextArea from "../AutoResizeTextArea";
import en from "@/locales/en";

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

  // visualViewport mock
  Object.defineProperty(window, "visualViewport", {
    writable: true,
    value: {
      width: 800,
      height: 600,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });

  // ResizeObserver mock
  class MockResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
  global.ResizeObserver = MockResizeObserver;
});

describe("AutoResizeTextArea component", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders correctly with custom placeholder and text length limit", () => {
    const setPostText = vi.fn();
    render(
      <MantineProvider>
        <AutoResizeTextArea
          text="hello world"
          setPostText={setPostText}
          disabled={false}
          placeHolder="Enter info"
          locale={en}
          max={10000}
          isEnableBrackets={false}
        />
      </MantineProvider>
    );

    // Check placeholder
    expect(screen.getByPlaceholderText("Enter info")).toBeInTheDocument();
    // Check characters counter
    expect(screen.getByText("11/10,000")).toBeInTheDocument();
  });
});
