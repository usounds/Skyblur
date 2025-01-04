import DOMPurify from 'dompurify';
import Typography from '@mui/material/Typography';
import { MatchInfo } from "@/type/types";
import{ useEffect, useState } from 'react';

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

const PostTextWithBold = ({ postText, isValidateBrackets,mention }: { postText: string, isValidateBrackets: boolean ,mention: MatchInfo[]}) => {
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
    
      // HTMLエスケープ後にカスタム処理を適用
      text = text
        .replace(/\[(.*?)\]/gs, (_, p1) => {
          return `<strong>${p1}</strong>`;
        })
        .replace(
          /https?:\/\/[-_.!~*'a-zA-Z0-9;\/?:\@&=+\$,%#\u3000-\u30FE\u4E00-\u9FA0\uFF01-\uFFE3]+/g,
          (url) => `<a href="${url}" target="_blank" class="text-blue-700">${url}</a>`
        )
        .replace(/\n/g, '<br>');

        // detectedPatternWithDetailsを使用してリンクを置き換える
        for (const match of mention) {
          const link = `<a href="https://bsky.app/profile/${match.did}">${match.detectedString}</a>`;
          const regex = new RegExp(match.detectedString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'); // 正規表現の特殊文字をエスケープ
          text = text.replace(regex, link);
        }
    
      setProcessedText(text);
    };

    processText();
  }, [postText]);

  // dangerouslySetInnerHTMLを使ってレンダリング
  return (
    <Typography
      className="whitespace-pre-wrap break-words text-gray-800"
      dangerouslySetInnerHTML={{ __html: processedText }}
    />
  );
};

export default PostTextWithBold;