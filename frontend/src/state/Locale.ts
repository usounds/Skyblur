import en from "@/locales/en";
import ja from "@/locales/ja";
import { create } from "zustand";

export type Locales = 'en' | 'ja';
type LocaleData = typeof en;

interface LocaleState {
  locale: Locales;
  setLocale: (newLocale: Locales) => void;
  initLocale: (fallbackLocale?: Locales) => void;
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
    // クッキーに保存 (API 経由で HttpOnly クッキーを設定)
    if (typeof window !== 'undefined') {
      fetch('/api/locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: newLocale }),
      }).catch(() => {});
    }
    set({ locale: newLocale });
  },
  initLocale: (fallbackLocale) => {
    const locale = fallbackLocale ?? readLocaleCookie();
    if (locale) {
      set({ locale });
    }
  }
}));

// 互換性のための以前のシグネチャを維持しつつ、ストアを使用
export const useLocale = () => {
  const locale = useLocaleStore((state) => state.locale);
  const localeData: LocaleData = locale === 'en' ? en : ja;
  return { locale, localeData };
};
