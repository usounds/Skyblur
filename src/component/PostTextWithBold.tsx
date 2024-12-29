import DOMPurify from 'dompurify';
import Typography from '@mui/material/Typography';

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

const PostTextWithBold = ({ postText, isValidateBrackets }: { postText: string, isValidateBrackets: boolean }) => {
  let processedText = escapeHTML(postText);
  processedText = escapeTag(processedText)

  // 括弧のバリデーションをチェックし、エラーがあれば括弧を削除
  if (isValidateBrackets && (validateBrackets(processedText) || areBracketsUnbalanced(processedText))) {
    processedText = processedText.replace(/[\[\]]/g, "");
    console.log("Updated postText:", processedText);
  }

  // HTMLエスケープ後にカスタム処理を適用
  processedText = escapeHTML(processedText)
    .replace(/\[(.*?)\]/gs, (_, p1) => {
      return `<strong>${p1}</strong>`;
    })
    .replace(
      /https?:\/\/[-_.!~*'a-zA-Z0-9;\/?:\@&=+\$,%#\u3000-\u30FE\u4E00-\u9FA0\uFF01-\uFFE3]+/g,
      (url) =>
        `<a href="${url}" target="_blank" class="text-blue-700">${url}</a>`
    )
    .replace(/\n/g, '<br>');

  // dangerouslySetInnerHTMLを使ってレンダリング
  return (
    <Typography
      className="whitespace-pre-wrap break-words text-gray-800"
      dangerouslySetInnerHTML={{ __html: processedText }}
    />
  );
};

export default PostTextWithBold;
