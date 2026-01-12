"use client";

import { Locales, useLocale, useLocaleStore } from "@/state/Locale";
import { Select } from "@mantine/core";
import React from "react";
import { useRouter } from 'next/navigation';

const localeOptions = [
  { value: 'ja', label: 'Japanese' },
  { value: 'en', label: 'English' },
];

const LanguageSelect: React.FC = () => {
  const router = useRouter();
  const { locale: localeString } = useLocale();
  const setLocale = useLocaleStore(state => state.setLocale);

  const handleChange = (val: string | null) => {
    if (!val) return;

    const newLocale: Locales = val as Locales;

    if (typeof window !== 'undefined') {
      setLocale(newLocale);
      // ページをリフレッシュして変更を反映
      router.refresh();
    }
  };

  return (
    <Select
      label="Language"
      placeholder="Select language"
      searchable
      autoSelectOnBlur
      mt="md"
      data={localeOptions}
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
