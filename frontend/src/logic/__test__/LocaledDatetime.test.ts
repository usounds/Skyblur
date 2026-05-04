import { describe, expect, it, vi } from "vitest";

import { formatDateToLocale } from "../LocaledDatetime";

describe("formatDateToLocale", () => {
  it("formats dates with the default locale on the server", () => {
    const formatted = formatDateToLocale("2026-05-03T12:34:56Z");

    expect(formatted).toBe(
      new Intl.DateTimeFormat("en", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: false,
      }).format(new Date("2026-05-03T12:34:56Z")),
    );
  });

  it("uses navigator.language when browser globals exist", () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { language: "ja-JP" });

    try {
      const formatted = formatDateToLocale("2026-05-03T12:34:56Z");

      expect(formatted).toBe(
        new Intl.DateTimeFormat("ja-JP", {
          year: "numeric",
          month: "numeric",
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
          hour12: false,
        }).format(new Date("2026-05-03T12:34:56Z")),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
