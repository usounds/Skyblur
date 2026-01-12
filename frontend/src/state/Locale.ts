import en from "@/locales/en";
import ja from "@/locales/ja";
import { useSearchParams } from 'next/navigation';

export type Locales = 'en' | 'ja';
type LocaleData = typeof en;

export const useLocale = () => {
  const searchParams = useSearchParams();
  const lang = searchParams.get('lang');

  const locale: Locales = lang === 'en' ? 'en' : 'ja';
  const localeData: LocaleData = locale === 'en' ? en : ja;

  return { locale, localeData };
};