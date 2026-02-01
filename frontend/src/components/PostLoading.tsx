import React, { useEffect, useState } from "react";
import ContentLoader from "react-content-loader";

type ContentLoaderProps = React.ComponentProps<typeof ContentLoader>;

export const AvatarLoading: React.FC<ContentLoaderProps> = (props) => {
    return (
        <div className="ml-1">
            <ContentLoader
                speed={1}
                width={200}
                height={52}
                viewBox="0 0 200 52"
                backgroundColor="#b0b0b0"
                foregroundColor="#ffffff"
                {...props}
            >
                <rect x="60" y="10" rx="3" ry="3" width="85" height="8" />
                <rect x="60" y="32" rx="3" ry="3" width="130" height="8" />
                <circle cx="25" cy="25" r="25" />
            </ContentLoader>
        </div>
    );
};

export const PostBodyLoading: React.FC<ContentLoaderProps> = (props) => {
    const [viewBoxWidth, setViewBoxWidth] = useState(476);

    useEffect(() => {
        const updateViewBoxWidth = () => {
            const maxAllowedWidth = Math.min(window.innerWidth, 640);
            setViewBoxWidth(maxAllowedWidth - 24);
        };
        updateViewBoxWidth();
        window.addEventListener("resize", updateViewBoxWidth);
        return () => window.removeEventListener("resize", updateViewBoxWidth);
    }, []);

    return (
        <div className="ml-1">
            <ContentLoader
                speed={1}
                width="100%"
                height={60}
                viewBox={`0 0 ${viewBoxWidth} 60`}
                backgroundColor="#b0b0b0"
                foregroundColor="#ffffff"
                {...props}
            >
                <rect x="0" y="10" rx="3" ry="3" width={viewBoxWidth - 66} height="6" />
                <rect x="0" y="26" rx="3" ry="3" width={viewBoxWidth - 96} height="6" />
                <rect x="0" y="42" rx="3" ry="3" width="178" height="6" />
            </ContentLoader>
        </div>
    );
};

const PostLoading: React.FC<ContentLoaderProps> = (props) => {
    return (
        <>
            <AvatarLoading {...props} />
            <PostBodyLoading {...props} />
        </>
    );
};

export default PostLoading;