import { useLocaleStore } from "@/state/Locale";
import React, { useEffect } from "react";

const LanguageSelect: React.FC= () => {
  const localeString = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);

  useEffect(() => {
    // コンポーネントがマウントされたときやlocaleが変わったときに実行
    setLocale(localeString);
    // 必要であれば他の処理も記述する
  }, [localeString, setLocale]);

  const handleLocaleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setLocale(event.target.value);
  };

  return (
    <select
      className="py-2 px-1 pe-1 block border border-gray-600 bg-neutral-800 text-white rounded-lg text-sm"
      value={localeString}
      onChange={handleLocaleChange}
    >
      <option value="ja">Japanese</option>
      <option value="en">English</option>
    </select>
  );
};

export default LanguageSelect;
