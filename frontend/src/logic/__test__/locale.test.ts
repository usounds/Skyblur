import { describe, expect, it } from "vitest";
import { detectLocaleFromAcceptLanguage, normalizeLocale, resolveLocale } from "../locale";

describe("locale resolution", () => {
    it("prefers a valid cookie locale", () => {
        expect(resolveLocale("ja", "en-US,en;q=0.9")).toBe("ja");
        expect(resolveLocale("en", "ja-JP,ja;q=0.9")).toBe("en");
    });

    it("detects the best supported Accept-Language entry", () => {
        expect(detectLocaleFromAcceptLanguage("fr-FR,ja-JP;q=0.8,en-US;q=0.9")).toBe("en");
        expect(detectLocaleFromAcceptLanguage("fr-FR,ja-JP;q=0.9,en-US;q=0.8")).toBe("ja");
    });

    it("defaults to Japanese for unsupported or missing language signals", () => {
        expect(resolveLocale(undefined, "fr-FR,fr;q=0.9")).toBe("ja");
        expect(resolveLocale(undefined, undefined)).toBe("ja");
    });

    it("ignores invalid cookie values", () => {
        expect(normalizeLocale("de")).toBeNull();
        expect(resolveLocale("de", "en-US,en;q=0.9")).toBe("en");
    });
});
