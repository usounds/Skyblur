import React from "react";

const PostTextWithBold = ({ postText }: { postText: string }) => {
  // `[ ]` の間の部分を <strong> タグに置き換え
  const processedText = postText
    .replace(/\[(.*?)\]/gs, (match, p1) => {
      return `<strong>${p1}</strong>`;
    })
    // 指定されたURLの正規表現を使って URL を <a> タグに変換
    .replace(
      /https?:\/\/[-_.!~*'a-zA-Z0-9;\/?:\@&=+\$,%#\u3000-\u30FE\u4E00-\u9FA0\uFF01-\uFFE3]+/g,
      (url) => `<a href="${url}" target="_blank" class="text-blue-700">${url}</a>`
    );

  // dangerouslySetInnerHTMLを使ってHTMLをレンダリング
  return (
    <div
      className="whitespace-pre-wrap break-words text-gray-800"
      dangerouslySetInnerHTML={{ __html: processedText }}
    />
  );
};



export default PostTextWithBold;
