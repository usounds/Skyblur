"use client";

import { Locales, localeDataMap, useLocaleStore } from "@/state/Locale";
import { Select } from "@mantine/core";
import React, { useEffect } from "react";

const LanguageSelect: React.FC = () => {
  const localeString = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);

  useEffect(() => {
    setLocale(localeString);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          fontSize: 16,  // 16pxに設定
        },
      }}
      value={localeString}
      onChange={(val) => {
        if (val) setLocale(val as Locales);
      }}
    />
  );
};

export default LanguageSelect;
