import en from "@/locales/en";
import ja from "@/locales/ja";
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type State = {
  locale: string;
  localeData: typeof en | typeof ja;
};

type Action = {
  setLocale: (locale: string) => void;
};

const getUserLocale = () => {
  if (typeof window !== "undefined" && typeof navigator !== "undefined") {
    const userLanguages = navigator.language;
    console.log(userLanguages);  // デバッグ用のログ
    return userLanguages.startsWith('ja') ? 'ja' : 'en';
  }
  // サーバーサイドの場合のデフォルトの操作
  return 'en';
};

export const useLocaleStore = create<State & Action>()(
  persist(
    (set) => {
      const initialLocale = getUserLocale();
      return {
        locale: initialLocale,
        localeData: initialLocale === 'ja' ? ja : en,

        setLocale: (locale) => {
          const newLocaleData = locale === 'ja' ? ja : en;
          set({ locale, localeData: newLocaleData });
        },
      };
    },
    {
      name: 'zustand.preference.locale',
      partialize: (state) => ({ locale: state.locale })
    }
  )
);