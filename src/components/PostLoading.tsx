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
        <div className=" ml-1">
            <ContentLoader
                speed={1}
                width="100%"
                height={124}
                viewBox={`0 0 ${viewBoxWidth} 124`}
                backgroundColor="#b0b0b0"
                foregroundColor="#ffffff"
                {...props}
            >


                <rect x="60" y="10" rx="3" ry="3" width="110" height="8" />
                <rect x="60" y="32" rx="3" ry="3" width="65" height="8" />
                <rect x="0" y="74" rx="3" ry="3" width={viewBoxWidth - 66} height="6" />
                <rect x="0" y="90" rx="3" ry="3" width={viewBoxWidth - 96} height="6" />
                <rect x="0" y="106" rx="3" ry="3" width="178" height="6" />

                <circle cx="25" cy="25" r="25" />
            </ContentLoader>
        </div>
    );
};

export default PostLoading;