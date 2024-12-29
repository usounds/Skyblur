import AbcIcon from '@mui/icons-material/Abc';
import HomeIcon from '@mui/icons-material/Home';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useLocaleStore } from "../../state/Locale";
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VisibilityIcon from '@mui/icons-material/Visibility';

export default function Content() {
  const locale = useLocaleStore((state) => state.localeData);


  const items = [
    {
      icon: <HomeIcon sx={{ color: 'text.secondary' }} />,
      title: "Skyblur",
      description:locale.Home_Welcome,
    },
    {
      icon: <AbcIcon sx={{ color: 'text.secondary' }} />,
      title: locale.Home_Landing001Title,
      description:locale.Home_Landing001Descrtption,
    },
    {
      icon: <VisibilityOffIcon sx={{ color: 'text.secondary' }} />,
      title: locale.Home_Landing002Title,
      description:locale.Home_Landing002Descrtption,
    },
    {
      icon: <VisibilityIcon sx={{ color: 'text.secondary' }} />,
      title: locale.Home_Landing003Title,
      description:locale.Home_Landing003Descrtption,
    }
  ]

  return (
    <Stack
      sx={{ flexDirection: 'column', alignSelf: 'center', gap: 4, maxWidth: 450 }}
    >
      {items.map((item, index) => (
        <Stack key={index} direction="row" sx={{ gap: 2 }}>
          {item.icon}
          <div>
            <Typography gutterBottom sx={{ fontWeight: 'medium' }}>
              {item.title}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {item.description}
            </Typography>
          </div>
        </Stack>
      ))}
    </Stack>
  );
}
