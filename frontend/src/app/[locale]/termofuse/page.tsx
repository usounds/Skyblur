import { notFound } from "next/navigation";
import { generateTermsMetadata, renderTermsPage } from "@/app/termofuse/TermsPage";
import { normalizeLocale } from "@/logic/locale";

type LocaleTermsPageParams = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return [{ locale: "ja" }, { locale: "en" }];
}

export async function generateMetadata({ params }: LocaleTermsPageParams) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  if (!locale) notFound();

  return generateTermsMetadata(locale);
}

export default async function LocalizedTermsPage({ params }: LocaleTermsPageParams) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  if (!locale) notFound();

  return renderTermsPage(locale);
}
