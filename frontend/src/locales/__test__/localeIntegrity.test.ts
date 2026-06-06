import { describe, expect, it } from "vitest";

import en from "../en";
import ja from "../ja";
import { flattenLocale } from "../flatten";
import { localeFlatMapping } from "../flatMapping";
import enBaseline from "./fixtures/en.baseline.json";
import jaBaseline from "./fixtures/ja.baseline.json";
import enMessages from "../messages/en.json";
import jaMessages from "../messages/ja.json";

function placeholders(value: string) {
  return [...value.matchAll(/\{\d+\}/g)].map(([placeholder]) => placeholder).sort();
}

function collectLeafPaths(value: unknown, prefix: string[] = []): string[] {
  if (typeof value === "string") return [prefix.join(".")];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Locale JSON leaves must be strings: ${prefix.join(".")}`);
  }
  return Object.entries(value).flatMap(([key, child]) => collectLeafPaths(child, [...prefix, key]));
}

describe("locale integrity", () => {
  it("keeps generated flat locale exports identical to the migration baseline", () => {
    expect(en).toEqual(enBaseline);
    expect(ja).toEqual(jaBaseline);
  });

  it("keeps English and Japanese flat key sets aligned", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ja).sort());
    expect(Object.keys(en)).toHaveLength(355);
  });

  it("keeps all flat locale values as strings", () => {
    for (const [flatKey, value] of Object.entries(en)) {
      expect(typeof value, `en.${flatKey}`).toBe("string");
    }
    for (const [flatKey, value] of Object.entries(ja)) {
      expect(typeof value, `ja.${flatKey}`).toBe("string");
    }
  });

  it("keeps placeholder sets aligned between languages", () => {
    for (const flatKey of Object.keys(en)) {
      expect(placeholders(ja[flatKey as keyof typeof ja]), flatKey).toEqual(placeholders(en[flatKey as keyof typeof en]));
    }
  });

  it("covers every JSON string leaf with the explicit flat mapping", () => {
    const mappedPaths = Object.values(localeFlatMapping).map((jsonPath) => jsonPath.join(".")).sort();
    expect(collectLeafPaths(enMessages).sort()).toEqual(mappedPaths);
    expect(collectLeafPaths(jaMessages).sort()).toEqual(mappedPaths);
  });

  it("keeps dynamic PostComposer flat keys available", () => {
    const postComposerKeys = Object.keys(flattenLocale(enMessages, localeFlatMapping)).filter((flatKey) =>
      flatKey.startsWith("PostComposer_"),
    );
    expect(postComposerKeys).toEqual(Object.keys(en).filter((flatKey) => flatKey.startsWith("PostComposer_")));
    expect(postComposerKeys.length).toBeGreaterThan(20);
  });
});
