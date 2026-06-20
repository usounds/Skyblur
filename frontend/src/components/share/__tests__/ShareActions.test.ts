import { describe, expect, it } from "vitest";

import { buildNativeShareData, buildShareTextForX } from "../ShareActions";

describe("buildShareTextForX", () => {
  it("uses the masked post text when available", () => {
    expect(buildShareTextForX("I love ○○○○○!", "fallback")).toBe("I love ○○○○○!");
  });

  it("falls back when the post text is empty", () => {
    expect(buildShareTextForX("   ", "Read on Skyblur")).toBe("Read on Skyblur");
  });

  it("fits double-weight text alongside the X URL and truncates with an ellipsis", () => {
    const result = buildShareTextForX("a".repeat(300), "fallback");

    expect(result).toHaveLength(128);
    expect(result.endsWith("…")).toBe(true);
  });
});

describe("buildNativeShareData", () => {
  it("includes the post URL in the text for share targets that ignore the url field", () => {
    expect(buildNativeShareData("Skyblur", "I love ○○○○○!", "https://skyblur.uk/post/example/1")).toEqual({
      title: "Skyblur",
      text: "I love ○○○○○!\n\nhttps://skyblur.uk/post/example/1",
      url: "https://skyblur.uk/post/example/1",
    });
  });
});
