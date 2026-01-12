"use client";

import { Locales, useLocale } from "@/state/Locale";
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

  const handleChange = (val: string | null) => {
    if (!val) return;

    const newLocale: Locales = val as Locales;

    // URL のクエリを置き換え (状態更新はURL変更で行われる)
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
