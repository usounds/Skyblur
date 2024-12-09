import React from "react";

const PostTextWithBold = ({ postText }: { postText: string }) => {
  // `[ ]` の間の部分を <strong> タグに置き換え
  const processedText = postText.replace(/\[(.*?)\]/gs, (match, p1) => {
    return `<strong>${p1}</strong>`;
  });

  // dangerouslySetInnerHTMLを使ってHTMLをレンダリング
  return (
    <div className="whitespace-pre-wrap break-words text-gray-800" dangerouslySetInnerHTML={{ __html: processedText }} />
  );
};

export default PostTextWithBold;
