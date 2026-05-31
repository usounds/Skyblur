import en from "@/locales/en";
import ja from "@/locales/ja";
import { create } from "zustand";

export type Locales = 'en' | 'ja';
type LocaleData = typeof en;

interface LocaleState {
  locale: Locales;
  setLocale: (newLocale: Locales) => void;
  initLocale: () => void;
}

function readLocaleCookie(): Locales | undefined {
  if (typeof document === 'undefined') return undefined;

  const langCookie = document.cookie
    .split('; ')
    .find(row => row.startsWith('lang='))
    ?.split('=')[1];

  return langCookie === 'en' || langCookie === 'ja' ? langCookie : undefined;
}

const initialLocale = readLocaleCookie() ?? 'ja';

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: initialLocale,
  setLocale: (newLocale) => {
    // クッキーに保存
    if (typeof document !== 'undefined') {
      document.cookie = `lang=${newLocale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    }
    set({ locale: newLocale });
  },
  initLocale: () => {
    const l = readLocaleCookie();
    if (l) {
      set({ locale: l });
    }
  }
}));

// 互換性のための以前のシグネチャを維持しつつ、ストアを使用
export const useLocale = () => {
  const locale = useLocaleStore((state) => state.locale);
  const localeData: LocaleData = locale === 'en' ? en : ja;
  return { locale, localeData };
};
