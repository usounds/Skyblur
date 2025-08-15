// next.config.js
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// 開発環境用初期化
initOpenNextCloudflareForDev();

export default {
  output: "standalone",
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "backet.skyblur.uk",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn.bsky.app",
        pathname: "/**",
      },
    ],
  },
};
