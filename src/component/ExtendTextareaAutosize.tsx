import React, { forwardRef } from 'react';
import TextareaAutosize2 from '@mui/material/TextareaAutosize';
import { styled } from '@mui/system';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

interface ExtendTextareaAutosizeProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  maxLength: number,
}

const TextareaAutosizeStyled = styled(TextareaAutosize2)(
  ({ theme }) => `
  box-sizing: border-box;
  width: 100%;
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 0.875rem;
  font-weight: 400;
  line-height: 1.5;
  padding: 8px 12px;
  border-radius: 8px;
  color: ${theme.palette.mode === 'dark' ? grey[300] : grey[900]};
  background: ${theme.palette.mode === 'dark' ? grey[900] : '#fff'};
  border: 1px solid ${theme.palette.mode === 'dark' ? grey[700] : grey[200]};
  box-shadow: 0 2px 2px ${theme.palette.mode === 'dark' ? grey[900] : grey[50]};

  &:hover {
    border-color: ${grey[400]};
  }

  &:focus {
    border-color: ${grey[400]};
    box-shadow: 0 0 0 3px ${theme.palette.mode === 'dark' ? blue[600] : blue[200]};
  }

  /* firefox */
  &:focus-visible {
    outline: 0;
  }
`,
);

const ExtendTextareaAutosize = forwardRef<HTMLTextAreaElement, ExtendTextareaAutosizeProps>(
  ({ placeholder, value, onChange, maxLength }, ref?) => {
    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = event.target.value;
      if (onChange) {
        onChange(newValue);
      }
    };

    return (
      <>
        <Box
          sx={{
            maxHeight: '20vh', // 最大高さを制限
            overflowY: 'auto', // スクロールを有効化
          }}
        >
          <TextareaAutosizeStyled
            aria-label="textarea"
            placeholder={placeholder}
            value={value}
            onChange={handleChange}
            ref={ref}
            maxLength={maxLength}
            style={{
              resize: 'none', // 手動リサイズを無効化
              width: '100%',  // 必要に応じて幅を指定
            }}
          />
        </Box>
        <Typography variant="body2" sx={{
          color: 'text.secondary',
          padding: '1px 5px',
          textAlign: 'right'
        }}>
          {value ? value.length : 0} / {maxLength}
        </Typography>
      </>
    );
  }
);

export default ExtendTextareaAutosize;

const blue = {
  100: '#DAECFF',
  200: '#b6daff',
  400: '#3399FF',
  500: '#007FFF',
  600: '#0072E5',
  900: '#003A75',
};

const grey = {
  50: '#F3F6F9',
  100: '#E5EAF2',
  200: '#DAE2ED',
  300: '#C7D0DD',
  400: '#B0B8C4',
  500: '#9DA8B7',
  600: '#6B7A90',
  700: '#434D5B',
  800: '#303740',
  900: '#1C2025',
};