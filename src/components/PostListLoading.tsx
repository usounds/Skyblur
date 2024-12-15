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
                height={200}
                viewBox={`0 0 ${viewBoxWidth} 200`}
                backgroundColor="#b0b0b0"
                foregroundColor="#ffffff"
                {...props}
            >
                <circle cx="10" cy="20" r="8" />
                <rect x="25" y="15" rx="5" ry="5" width={viewBoxWidth-30} height="10" />
                <circle cx="10" cy="50" r="8" />
                <rect x="25" y="45" rx="5" ry="5" width={viewBoxWidth-30} height="10" />
                <circle cx="10" cy="80" r="8" />
                <rect x="25" y="75" rx="5" ry="5" width={viewBoxWidth-30} height="10" />
                <circle cx="10" cy="110" r="8" />
                <rect x="25" y="105" rx="5" ry="5" width={viewBoxWidth-30} height="10" />
            </ContentLoader>
        </div>
    );
};

export default PostLoading;