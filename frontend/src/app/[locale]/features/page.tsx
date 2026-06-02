import { notFound } from "next/navigation";
import { generateFeaturesMetadata, renderFeaturesPage } from "@/app/features/FeaturesPage";
import { normalizeLocale } from "@/logic/locale";

type LocaleFeaturesPageParams = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return [{ locale: "ja" }, { locale: "en" }];
}

export async function generateMetadata({ params }: LocaleFeaturesPageParams) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  if (!locale) notFound();

  return generateFeaturesMetadata(locale);
}

export default async function LocalizedFeaturesPage({ params }: LocaleFeaturesPageParams) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  if (!locale) notFound();

  return renderFeaturesPage(locale);
}
