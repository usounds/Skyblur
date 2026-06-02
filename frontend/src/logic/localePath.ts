import type { Locales } from "@/state/Locale";

export const localizedPublicPages = ["", "features", "termofuse"] as const;
export type LocalizedPublicPage = typeof localizedPublicPages[number];

const localizedPublicPageSet = new Set<string>(localizedPublicPages);

export function getPathLocale(pathname: string): Locales | null {
  const segment = pathname.split("/").filter(Boolean)[0];
  return segment === "ja" || segment === "en" ? segment : null;
}

export function getLocalizedPublicPage(pathname: string): LocalizedPublicPage | null {
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];
  const rest = first === "ja" || first === "en" ? segments.slice(1) : segments;
  const page = rest.join("/");

  if (localizedPublicPageSet.has(page)) {
    return page as LocalizedPublicPage;
  }

  return null;
}

export function getLocalizedHref(locale: Locales, page: LocalizedPublicPage): string {
  return page ? `/${locale}/${page}` : `/${locale}`;
}

export function getAlternateLocalizedHref(pathname: string, locale: Locales): string | null {
  const page = getLocalizedPublicPage(pathname);
  return page === null ? null : getLocalizedHref(locale, page);
}
