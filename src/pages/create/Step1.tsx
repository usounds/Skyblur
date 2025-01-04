import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useLocaleStore } from "@/state/Locale";
import ExtendTextareaAutosize from '@/component/ExtendTextareaAutosize';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import { useTempPostStore } from "@/state/TempPost";
import DeleteModal from "@/component/DeleteModal";
import { useRef, useState } from "react";
import Box from '@mui/material/Box';

interface ContentProps {
  warning: string;
  setWarning: (warning: string) => void; // setWarning の型を指定
}

export default function Content({ warning, setWarning }: ContentProps) {
  const locale = useLocaleStore((state) => state.localeData);
  const simpleMode = useTempPostStore((state) => state.simpleMode);
  const setSimpleMode = useTempPostStore((state) => state.setSimpleMode);
  const text = useTempPostStore((state) => state.text);
  const setText = useTempPostStore((state) => state.setText);
  const additional = useTempPostStore((state) => state.additional);
  const setAdditional = useTempPostStore((state) => state.setAdditional);
  const [isModal, setIsModal] = useState<boolean>(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isIncludeFullBranket, setIsIncludeFullBranket] = useState<boolean>(false)

  const handleConfirm = () => {
    setSimpleMode(!simpleMode)
    setText('')
    setAdditional('')
    setIsModal(false)

  }
  const handleClose = () => {
    setIsModal(false)

  }
  const handleChangeMode = (checked: boolean) => {
    setSimpleMode(checked)
    handleTextChange(text)

  }
  function containsFullWidthBrackets(input: string): boolean {
    const fullWidthBracketsPattern = /［|］/;
    return fullWidthBracketsPattern.test(input);
  }

  function containsHalfWidthBrackets(input: string): boolean {
    const fullWidthBracketsPattern = /[\[\]]/;
    return fullWidthBracketsPattern.test(input);
  }


  function convertFullWidthToHalfWidthBrackets(): void {
    handleTextChange(text.replace(/［/g, '[').replace(/］/g, ']'))
  }


  function areBracketsUnbalanced(input: string): boolean {
    let openBracketsCount = 0;
    let closeBracketsCount = 0;

    for (const char of input) {
      if (char === '[') {
        openBracketsCount++;
      } else if (char === ']') {
        closeBracketsCount++;
      }
    }

    return openBracketsCount !== closeBracketsCount;
  }

  function validateBrackets(input: string): boolean {
    let insideBracket = false; // 現在 `[` の中にいるかどうかを追跡

    for (let i = 0; i < input.length; i++) {
      const char = input[i];

      if (char === "[") {
        // すでに `[` の中にいる場合はエラー
        if (insideBracket) {
          return true;
        }
        insideBracket = true; // `[` の中に入る
      } else if (char === "]") {
        // `[` の中にいる場合は終了
        if (insideBracket) {
          insideBracket = false;
        }
      }
    }

    if (insideBracket) return true

    return false; // エラーがなければ `error: false`
  }


  const handleTextChange = (value: string) => {
    setWarning('')
    if (!simpleMode) {
      setIsIncludeFullBranket(containsFullWidthBrackets(value))
      if (validateBrackets(value)) {
        setWarning(locale.CreatePost_ErrorDuplicateBranket)

      } else if (areBracketsUnbalanced(value)) {
        setWarning(locale.CreatePost_BracketsUnbalanced)
      }
    } else {
      if(containsHalfWidthBrackets(value)){
        setWarning(locale.CreatePost_SimplewithBranket)
      }

    }


    setText(value)

  }

  const handleAddBrackets = () => {
    console.log('handleAddBrackets')
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start === end) {
      return;
    }

    const value = textarea.value;
    const selectedText = value.substring(start, end);
    const updatedText =
      value.substring(0, start) + `[${selectedText}]` + value.substring(end);

    // テキストを更新
    setText(updatedText);

    // カーソルの位置を調整
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = start + selectedText.length + 2;
  };

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
          モードの切り替え
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={simpleMode} // `checked` を使用することで状態が反映される
              onChange={(_, checked) => handleChangeMode(checked)} // `checked` を渡す
            />
          }
          label={locale.CreatePost_SimpleMode}
        />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          通常モードはご自身で伏せるところを選べ、シンプルモードは2行目以降が自動で伏せられます。
        </Typography>

        {isModal &&
          <DeleteModal content={'モードを切り替えると、本文がクリアされます。モードを切り替えますか？'} onConfirm={handleConfirm} onClose={handleClose} title={'モードの切り替え'} execLabel={"切り替える"} />
        }

      </Stack>

      <Stack direction="column" sx={{ gap: 0.5 }}>
        <Typography gutterBottom sx={{ fontWeight: 'medium' }}>
          {locale.CreatePost_Post}
        </Typography>
        <ExtendTextareaAutosize placeholder={locale.CreatePost_PostPlaceHolder} value={text} onChange={handleTextChange} ref={textareaRef} maxLength={300} />
        {warning &&
          <Typography variant="body2" color="red">
            {warning}
          </Typography>
        }
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {simpleMode ? locale.CreatePost_PostSimpleModeDescription : locale.CreatePost_PostComplexDescription}
        </Typography>
        {!simpleMode &&
          <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <Button
              variant="contained"
              sx={{ width: 'fit-content' }}
              onClick={handleAddBrackets}
            >
              {locale.CreatePost_AddBrackets}
            </Button>
          </Box>
        }
        {isIncludeFullBranket &&
          <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <Button
              variant="contained"
              sx={{ width: 'fit-content' }}
              onClick={convertFullWidthToHalfWidthBrackets}
            >
              {locale.CreatePost_BracketFromFullToHalf}
            </Button>
          </Box>
        }
      </Stack>

      <Stack direction="column" sx={{ gap: 0.5 }}>
        <Typography gutterBottom sx={{ fontWeight: 'medium' }}>
          {locale.CreatePost_Additional}
        </Typography>
        <ExtendTextareaAutosize placeholder={locale.CreatePost_AdditionalPlaceHolder} value={additional} onChange={setAdditional} maxLength={100000} />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {locale.CreatePost_AdditionalDescription}
        </Typography>
      </Stack>
    </Stack >
  );
}
