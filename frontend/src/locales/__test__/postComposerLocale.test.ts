import { describe, expect, it } from "vitest";

import en from "../en";
import ja from "../ja";

describe("PostComposer locale keys", () => {
  it("keeps Japanese and English PostComposer keys aligned", () => {
    const jaKeys = Object.keys(ja).filter((key) => key.startsWith("PostComposer_")).sort();
    const enKeys = Object.keys(en).filter((key) => key.startsWith("PostComposer_")).sort();

    expect(jaKeys).toEqual(enKeys);
    expect(jaKeys.length).toBeGreaterThan(20);
  });
});
