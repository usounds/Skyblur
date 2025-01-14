import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useLocaleStore } from "@/state/Locale";
import { useTempPostStore } from "@/state/TempPost";

import PostTextWithBold from "@/component/PostTextWithBold";
import Divider from '@mui/material/Divider';

export default function Content() {
  const locale = useLocaleStore((state) => state.localeData);
  const text = useTempPostStore((state) => state.text);
  const additional = useTempPostStore((state) => state.additional);
  const mention = useTempPostStore((state) => state.mention);
  const blurredText = useTempPostStore((state) => state.blurredText);

  return (
    <Stack
      sx={{
        minWidth: '0',
        maxWidth: '720px',
        width: {
          xs: '100%',
          sm: '620px',
          md: '720px',
        },
        gap: 2,
      }}
    >
      <Stack direction="column" >
        <Typography gutterBottom sx={{ fontWeight: 'medium' }}>
          {locale.CreatePost_Preview}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {locale.CreatePost_PreviewDescription}
        </Typography>

        <PostTextWithBold postText={blurredText} isValidateBrackets={false} mention={mention || []} />


      </Stack>
      <Stack direction="column" sx={{ gap: 1 }}>
        <Typography gutterBottom sx={{ fontWeight: 'medium' }}>
          Skyblurに投稿されるポストのプレビュー
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          実際にはスクロールなしで表示されます
        </Typography>


        <PostTextWithBold postText={text} isValidateBrackets={true} mention={[]} />
        {additional && <>
          <Divider variant="middle" />
          <PostTextWithBold postText={additional} isValidateBrackets={false} mention={[]} />
        </>}

      </Stack>
    </Stack >
  );
}
