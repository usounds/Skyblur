import DOMPurify from 'dompurify';
import Typography from '@mui/material/Typography';
import { MatchInfo } from "@/type/types";
import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';

// HTMLエスケープ用の関数
const escapeHTML = (str: string): string => {
  return DOMPurify.sanitize(str);
};

// 括弧のバリデーション関数
function validateBrackets(input: string): boolean {
  let openBracket = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === "[") {
      if (openBracket) return true; // 多重ネストエラー
      openBracket = true;
    } else if (char === "]") {
      if (!openBracket) return true; // 開き括弧がない
      openBracket = false;
    }
  }

  return openBracket; // 最後に閉じ括弧がない場合もエラー
}

const escapeTag = (str: string): string => {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

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

const PostTextWithBold = ({ postText, isValidateBrackets, mention }: { postText: string, isValidateBrackets: boolean, mention: MatchInfo[] }) => {
  const [processedText, setProcessedText] = useState<string>('');

  useEffect(() => {
    const processText = async () => {
      let text = escapeHTML(postText);
      text = escapeTag(text);
      console.log(text)

      // 括弧のバリデーションをチェックし、エラーがあれば括弧を削除
      if (isValidateBrackets && (validateBrackets(text) || areBracketsUnbalanced(text))) {
        text = text.replace(/[\[\]]/g, "");
        console.log("Updated postText:", text);
      }

      if (isValidateBrackets) {
        text = text
          .replace(/\[(.*?)\]/gs, (_, p1) => {
            return `<strong>${p1}</strong>`;
          })

      }

      // URL処理
      text = text
        .replace(
          /https?:\/\/[-_.!~*'a-zA-Z0-9;\/?:\@&=+\$,%#\u3000-\u30FE\u4E00-\u9FA0\uFF01-\uFFE3]+/g,
          (url) => `<a href="${url}" target="_blank" class="text-blue-700">${url}</a>`
        )

      //改行処理
      text = text
        .replace(/\n/g, '<br>');
      setProcessedText(text);
    };

    processText();
  }, [postText]);

  // dangerouslySetInnerHTMLを使ってレンダリング
  return (
    <Box
      sx={{
        maxHeight: '20vh', // 最大高さを制限
        overflowY: 'auto', // スクロールを有効化
      }}
    >
      <Typography
        className="whitespace-pre-wrap break-words text-gray-800"
        dangerouslySetInnerHTML={{ __html: processedText }}
        sx={{
          display: 'flex',
          flexDirection: 'column', // 縦方向に並べる
          maxHeight: '20vh', // ビューポート全体の高さを確保
        }}
      />
    </Box>
  );
};

export default PostTextWithBold;