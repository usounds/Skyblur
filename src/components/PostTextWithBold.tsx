import React from "react";

// HTMLエスケープ用の関数
const escapeHTML = (str: string): string => {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const PostTextWithBold = ({ postText }: { postText: string }) => {
  // HTMLエスケープ後にカスタム処理を適用
  const processedText = escapeHTML(postText)
    .replace(/\[(.*?)\]/gs, (match, p1) => {
      return `<strong>${p1}</strong>`;
    })
    .replace(
      /https?:\/\/[-_.!~*'a-zA-Z0-9;\/?:\@&=+\$,%#\u3000-\u30FE\u4E00-\u9FA0\uFF01-\uFFE3]+/g,
      (url) => `<a href="${url}" target="_blank" class="text-blue-700">${url}</a>`
    );

  // dangerouslySetInnerHTMLを使ってレンダリング
  return (
    <div
      className="whitespace-pre-wrap break-words text-gray-800"
      dangerouslySetInnerHTML={{ __html: processedText }}
    />
  );
};

export default PostTextWithBold;