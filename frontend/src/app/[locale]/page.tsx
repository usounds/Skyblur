import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomePage } from "@/app/HomePage";
import { normalizeLocale } from "@/logic/locale";
import type { Locales } from "@/state/Locale";
import en from "@/locales/en";
import ja from "@/locales/ja";

type LocalePageParams = {
  params: Promise<{ locale: string }>;
};

const homeAlternates = {
  canonical: "/ja",
  languages: {
    ja: "/ja",
    en: "/en",
  },
};

function resolveRouteLocale(rawLocale: string): Locales {
  const locale = normalizeLocale(rawLocale);
  if (!locale) notFound();
  return locale;
}

export function generateStaticParams() {
  return [{ locale: "ja" }, { locale: "en" }];
}

export async function generateMetadata({ params }: LocalePageParams): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveRouteLocale(rawLocale);
  const copy = locale === "ja" ? ja : en;

  return {
    title: copy.Common_Title,
    description: copy.Common_Description,
    alternates: {
      ...homeAlternates,
      canonical: `/${locale}`,
    },
    openGraph: {
      title: copy.Common_Title,
      description: copy.Common_OGDescription,
      url: `https://skyblur.uk/${locale}`,
      siteName: "Skyblur",
      locale: locale === "ja" ? "ja_JP" : "en_US",
      type: "website",
      images: ["/ogp.png"],
    },
    twitter: {
      card: "summary_large_image",
      title: copy.Common_Title,
      description: copy.Common_OGDescription,
      images: ["/ogp.png"],
    },
  };
}

export default async function LocalizedHomePage({ params }: LocalePageParams) {
  const { locale: rawLocale } = await params;
  const locale = resolveRouteLocale(rawLocale);

  return <HomePage locale={locale} url={`https://skyblur.uk/${locale}`} />;
}
