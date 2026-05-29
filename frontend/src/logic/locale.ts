import type { Locales } from "@/state/Locale";

const supportedLocales = ["ja", "en"] as const;
export const defaultLocale: Locales = "ja";

export function normalizeLocale(value: string | undefined | null): Locales | null {
    return supportedLocales.includes(value as Locales) ? (value as Locales) : null;
}

export function detectLocaleFromAcceptLanguage(acceptLanguage: string | undefined | null): Locales | null {
    if (!acceptLanguage) return null;

    const candidates = acceptLanguage
        .split(",")
        .map((entry, index) => {
            const [rawTag, ...params] = entry.trim().split(";");
            const tag = rawTag.toLowerCase();
            const qParam = params.find((param) => param.trim().startsWith("q="));
            const q = qParam ? Number(qParam.trim().slice(2)) : 1;
            return {
                locale: normalizeLocale(tag.split("-")[0]),
                q: Number.isFinite(q) ? q : 0,
                index,
            };
        })
        .filter((candidate): candidate is { locale: Locales; q: number; index: number } => candidate.locale !== null && candidate.q > 0)
        .sort((a, b) => b.q - a.q || a.index - b.index);

    return candidates[0]?.locale ?? null;
}

export function resolveLocale(cookieLocale: string | undefined | null, acceptLanguage?: string | null): Locales {
    return normalizeLocale(cookieLocale) ?? detectLocaleFromAcceptLanguage(acceptLanguage) ?? defaultLocale;
}
