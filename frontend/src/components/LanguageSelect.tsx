"use client";

import { Locales, localeDataMap, useLocaleStore } from "@/state/Locale";
import { Select } from "@mantine/core";
import React from "react";
import { useRouter } from 'next/navigation';

const LanguageSelect: React.FC = () => {
  const router = useRouter();
  const localeString = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);

  const handleChange = (val: string | null) => {
    if (!val) return;

    const newLocale: Locales = val as Locales;

    // Zustand の状態を更新
    setLocale(newLocale);

    // URL のクエリを置き換え
    if (typeof window !== 'undefined') {
      const currentUrl = window.location.pathname;
      router.replace(`${currentUrl}?lang=${newLocale}`);
    }
  };

  return (
    <Select
      label="Language"
      placeholder="Select language"
      searchable
      autoSelectOnBlur
      mt="md"
      data={Object.entries(localeDataMap).map(([value, info]) => ({
        value,
        label: info.label,
      }))}
      styles={{
        input: {
          fontSize: 16, // 16pxに設定
        },
      }}
      value={localeString || 'ja'} // null の場合は ja を表示
      onChange={handleChange}
    />
  );
};

export default LanguageSelect;
