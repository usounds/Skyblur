"use client";
import en from "@/locales/en";
import ja from "@/locales/ja";
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ステートの型定義
type State = {
  locale: string;
  localeData: typeof en | typeof ja;
};

// アクションの型定義
type Action = {
  setLocale: (locale: string) => void;
};

// ユーザーの言語を取得する関数
const getUserLocale = () => {
  const userLanguages = navigator.language;
  console.log(userLanguages);  // デバッグ用のログ
  return userLanguages.startsWith('ja') ? 'ja' : 'en';
};

// Zustandストアの作成
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