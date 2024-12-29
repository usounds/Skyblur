import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import LanguageIcon from '@mui/icons-material/Language';
import { useLocaleStore, Locales } from '@/state/Locale';

export default function LanguageToggle() {
  const currentLocale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);

  // ロケールと表示名のマッピング
  const localeConfigs: Record<Locales, { tooltip: string }> = {
    ja: { tooltip: 'Japanese' },
    en: { tooltip: 'English' },
  };

  // 言語切り替え処理
  const toggleLocale = () => {
    const nextLocale: Locales = currentLocale === 'ja' ? 'en' : 'ja';
    setLocale(nextLocale);
    localStorage.setItem('app-locale', nextLocale);
  };

  return (
    <Tooltip title={localeConfigs[currentLocale].tooltip}>
      <IconButton
        onClick={toggleLocale}
        color="inherit"
        aria-label={`Switch to ${localeConfigs[currentLocale].tooltip}`}
      >
        <LanguageIcon />
      </IconButton>
    </Tooltip>
  );
}
