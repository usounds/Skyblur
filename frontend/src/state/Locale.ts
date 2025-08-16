import en from "@/locales/en";
import ja from "@/locales/ja";
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type LocaleInfo = {
  data: LocaleData;
  label: string;
};

export type Locales = 'en' | 'ja';
type LocaleData = typeof en;

export const localeDataMap: Record<Locales, LocaleInfo> = {
  ja: { data: ja, label: 'Japanese' },
  en: { data: en, label: 'English' },
};

type State = {
  locale: Locales|null;
  localeData: LocaleData;
};

type Action = {
  setLocale: (locale: Locales) => void;
  setLocaleData: (localeData: LocaleData) => void;
};

export const useLocaleStore = create<State & Action>()(
  persist(
    (set) => ({
      locale: null,
      localeData: localeDataMap['ja'].data, // 初期値は ja

      setLocale: (locale) => {
        set({ locale, localeData: localeDataMap[locale].data });
      },

      setLocaleData: (localeData) => set({ localeData }),
    }),
    {
      name: 'zustand.preference.locale',
      partialize: (state) => ({ locale: state.locale }), // locale のみ保存,
      onRehydrateStorage: () => (state) => {
        if (state) {
          const currentLocale = state.locale || 'ja';
          state.localeData = localeDataMap[currentLocale].data;
        }
      },
    }
  )
);