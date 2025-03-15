import { Locales, localeDataMap, useLocaleStore } from "@/state/Locale";
import React, { useEffect } from "react";

const LanguageSelect: React.FC = () => {
  const localeString = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);

  const handleLocaleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setLocale(event.target.value as Locales);
  };

  useEffect(() => {
    setLocale(localeString)

    // クリーンアップ
    return () => {
    };    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <select
        className="py-2 px-3 block border rounded-lg border-gray-300 text-sm w-full focus:outline-transparent focus:border-transparent"
        value={localeString}
        onChange={handleLocaleChange}
      >
        {Object.entries(localeDataMap).map(([value, info]) => (
          <option key={value} value={value}>
            {info.label}
          </option>
        ))}
      </select>


    </>
  );
};

export default LanguageSelect;