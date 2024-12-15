import { Locales, localeDataMap, useLocaleStore } from "@/state/Locale";
import React from "react";

const LanguageSelect: React.FC = () => {
  const localeString = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);

  const handleLocaleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setLocale(event.target.value as Locales);
  };

  return (
    <select
      className="py-2 px-1 pe-1 block border border-gray-600 bg-neutral-800 text-white rounded-lg text-sm"
      value={localeString}
      onChange={handleLocaleChange}
    >
      {Object.entries(localeDataMap).map(([value, info]) => (
        <option key={value} value={value}>
          {info.label}
        </option>
      ))}
    </select>
  );
};

export default LanguageSelect;