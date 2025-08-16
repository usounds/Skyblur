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
  locale: Locales;
  localeData: LocaleData;
};

type Action = {
  setLocale: (locale: Locales) => void;
};

export const useLocaleStore = create<State & Action>()(
  persist(
    (set) => ({
      // locale は初期化時に undefined（localStorage に任せる）
      locale: 'ja', // ここはダミー値。rehydrate で localStorage の値に置き換わる
      localeData: localeDataMap['ja'].data,

      setLocale: (locale) => set({ locale, localeData: localeDataMap[locale].data }),
    }),
    {
      name: 'zustand.preference.locale',
      partialize: (state) => ({ locale: state.locale }),

      // rehydrate 直後に localeData を更新
      onRehydrateStorage: () => (state) => {
        if (state) {
          useLocaleStore.setState({
            localeData: localeDataMap[state.locale].data,
          });
        }
      },
    }
  )
);
