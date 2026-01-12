import en from "@/locales/en";
import ja from "@/locales/ja";
import { create } from "zustand";

export type Locales = 'en' | 'ja';
type LocaleData = typeof en;

interface LocaleState {
  locale: Locales;
  localeData: LocaleData;
  setLocale: (newLocale: Locales) => void;
  initLocale: () => void;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: 'ja',
  localeData: ja,
  setLocale: (newLocale) => {
    // クッキーに保存
    if (typeof document !== 'undefined') {
      document.cookie = `lang=${newLocale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    }
    set({
      locale: newLocale,
      localeData: newLocale === 'en' ? en : ja
    });
  },
  initLocale: () => {
    if (typeof document === 'undefined') return;
    const langCookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('lang='))
      ?.split('=')[1];

    if (langCookie === 'en' || langCookie === 'ja') {
      const l = langCookie as Locales;
      set({ locale: l, localeData: l === 'en' ? en : ja });
    }
  }
}));

// 互換性のための以前のシグネチャを維持しつつ、ストアを使用
export const useLocale = () => {
  const { locale, localeData } = useLocaleStore();
  return { locale, localeData };
};