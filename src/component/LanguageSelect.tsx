import { Locales, localeDataMap, useLocaleStore } from "@/state/Locale";
import React, { useEffect } from "react";
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';

const LanguageSelect: React.FC = () => {
  const localeString = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);

  useEffect(() => {
    setLocale(localeString)

    // クリーンアップ
    return () => {
    };    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


  const handleChange = (event: SelectChangeEvent) => {
    setLocale(event.target.value as Locales);
  };


  return (
    <div>
      <FormControl fullWidth>
        <Select
          labelId="demo-simple-select-autowidth-label"
          id="demo-simple-select-autowidth"
          value={localeString}
          onChange={handleChange}
          label="Language"
        >

          {Object.entries(localeDataMap).map(([value, info]) => (
            <MenuItem key={value} value={value}>
              {info.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </div>
  );
};

export default LanguageSelect;