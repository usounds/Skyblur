import { describe, expect, it } from "vitest";

import { buildShareTextForX } from "../ShareActions";

describe("buildShareTextForX", () => {
  it("uses the masked post text when available", () => {
    expect(buildShareTextForX("I love ○○○○○!", "fallback")).toBe("I love ○○○○○!");
  });

  it("falls back when the post text is empty", () => {
    expect(buildShareTextForX("   ", "Read on Skyblur")).toBe("Read on Skyblur");
  });

  it("reserves space for the X URL and truncates with an ellipsis", () => {
    const result = buildShareTextForX("a".repeat(300), "fallback");

    expect(result).toHaveLength(256);
    expect(result.endsWith("…")).toBe(true);
  });
});
