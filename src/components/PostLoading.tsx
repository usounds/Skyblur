import React, { useEffect, useState } from "react";
import ContentLoader from "react-content-loader";

type ContentLoaderProps = React.ComponentProps<typeof ContentLoader>;

const PostLoading: React.FC<ContentLoaderProps> = (props) => {
  const [viewBoxWidth, setViewBoxWidth] = useState(476);

  useEffect(() => {
    const updateViewBoxWidth = () => {
      const maxAllowedWidth = Math.min(window.innerWidth, 640); // 640px is the max width for 'max-w-screen-sm'
      setViewBoxWidth(maxAllowedWidth - 24); // Adjust based on padding/margin if needed
    };

    // 初回ロード時及びリサイズ時に呼び出す
    updateViewBoxWidth();
    window.addEventListener("resize", updateViewBoxWidth);

    // クリーンアップでイベントリスナーを削除
    return () => window.removeEventListener("resize", updateViewBoxWidth);
  }, []);

  return (
    <div className="max-w-screen-sm">
      <ContentLoader 
        speed={1}
        width="100%"
        height={124}
        viewBox={`0 0 ${viewBoxWidth} 124`}
        backgroundColor="#b0b0b0"
        foregroundColor="#ffffff"
        {...props}
      >
        <rect x="48" y="8" rx="3" ry="3" width="88" height="6" /> 
        <rect x="48" y="26" rx="3" ry="3" width="52" height="6" /> 
        <rect x="0" y="56" rx="3" ry="3" width={viewBoxWidth - 66} height="6" />
        <rect x="0" y="72" rx="3" ry="3" width={viewBoxWidth - 96} height="6" />
        <rect x="0" y="88" rx="3" ry="3" width="178" height="6" />
        <circle cx="20" cy="20" r="20" />
      </ContentLoader>
    </div>
  );
};

export default PostLoading;