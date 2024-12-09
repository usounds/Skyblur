import React from "react";

interface LanguageSelectProps {
  selectedLocale: string;
  onChange: (locale: string) => void;
}

const LanguageSelect: React.FC<LanguageSelectProps> = ({ selectedLocale, onChange }) => {
  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(event.target.value); // `event.target.value`を抽出して渡す
  };

  return (
    <select
      className="py-2 px-1 pe-1 block border border-gray-600 bg-neutral-800 text-white rounded-lg text-sm"
      value={selectedLocale}
      onChange={handleSelectChange}
    >
      <option value="ja">Japanese</option>
      <option value="en">English</option>
    </select>
  );
};

export default LanguageSelect;
