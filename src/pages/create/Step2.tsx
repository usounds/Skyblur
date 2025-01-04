import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useLocaleStore } from "@/state/Locale";
import { useTempPostStore } from "@/state/TempPost";
import { useEffect } from "react";
import PostTextWithBold from "@/component/PostTextWithBold";
import Divider from '@mui/material/Divider';

export default function Content() {
  const locale = useLocaleStore((state) => state.localeData);
  const simpleMode = useTempPostStore((state) => state.simpleMode);
  const text = useTempPostStore((state) => state.text);
  const additional = useTempPostStore((state) => state.additional);
  const blurredText = useTempPostStore((state) => state.blurredText);
  const mention = useTempPostStore((state) => state.mention);

  useEffect(() => {
    let isCancelled = false;

    return () => {
      isCancelled = true; // 前の非同期処理をキャンセル
    };
  }, [text,simpleMode,additional,blurredText]);


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

        <PostTextWithBold postText={blurredText} isValidateBrackets={false} mention={mention || []}/>

        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {locale.CreatePost_PreviewDescription}
        </Typography>

      </Stack>
      <Stack direction="column" sx={{ gap: 1 }}>
        <Typography gutterBottom sx={{ fontWeight: 'medium' }}>
          Skyblurに投稿されるポストのプレビュー
        </Typography>

        <PostTextWithBold postText={text} isValidateBrackets={true}  mention={mention || []}/>
        <Divider variant="middle" />
        <PostTextWithBold postText={additional} isValidateBrackets={false} mention={mention || []} />

      </Stack>
    </Stack >
  );
}
