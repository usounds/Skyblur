import en from "@/locales/en";
import ja from "@/locales/ja";
//import kr from "@/locales/kr"; 
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type LocaleInfo = {
  data: LocaleData;
  label: string;
};

export type Locales = 'en' | 'ja' 
type LocaleData = typeof en;

export const localeDataMap: Record<Locales, LocaleInfo> = {
  ja: { data: ja, label: 'Japanese' },
  en: { data: en, label: 'English' },
//  kr: { data: kr, label: 'Korean' },
};

type State = {
  locale: Locales;
  localeData: LocaleData;
};

type Action = {
  setLocale: (locale: Locales) => void;
};

const getUserLocale = (): Locales => {
  if (typeof window !== "undefined" && typeof navigator !== "undefined") {
    const userLanguages = navigator.language;
    if (userLanguages.startsWith('ja')) return 'ja';
 //   if (userLanguages.startsWith('kr')) return 'kr';
    return 'en';
  }
  return 'en';
};

export const useLocaleStore = create<State & Action>()(
  persist(
    (set) => {
      const initialLocale = getUserLocale();
      return {
        locale: initialLocale,
        localeData: localeDataMap[initialLocale].data,

        setLocale: (locale) => {
          set({ locale, localeData: localeDataMap[locale].data });
        },
      };
    },
    {
      name: 'zustand.preference.locale',
      partialize: (state) => ({ locale: state.locale })
    }
  )
);
