import { useColorScheme } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import BrightnessAutoIcon from '@mui/icons-material/BrightnessAuto';

export default function ColorModeToggle() {
  const { mode, setMode } = useColorScheme();

  if (!mode) {
    return null;
  }

  // Currently supported modes and their corresponding icons
  const modeConfigs = {
    system: {
      icon: <BrightnessAutoIcon />,
      tooltip: 'System',
    },
    light: {
      icon: <LightModeIcon />,
      tooltip: 'Light',
    },
    dark: {
      icon: <DarkModeIcon />,
      tooltip: 'Dark',
    },
  };

  // Function to synchronize mui-mode and joy-mode
  const synchronizeModes = (newMode: 'system' | 'light' | 'dark') => {
    localStorage.setItem('mui-mode', newMode);
  };

  // Function to toggle between the modes
  const toggleMode = () => {
    const modeOrder: Array<'system' | 'light' | 'dark'> = ['light', 'dark', 'system'];
    const nextMode = modeOrder[(modeOrder.indexOf(mode) + 1) % modeOrder.length];
    setMode(nextMode);
    synchronizeModes(nextMode);
  };

  return (
    <Tooltip title={modeConfigs[mode].tooltip}>
      <IconButton
        onClick={toggleMode}
        color="inherit"
        aria-label={`Switch to ${modeConfigs[mode].tooltip}`}
      >
        {modeConfigs[mode].icon}
      </IconButton>
    </Tooltip>
  );
}
