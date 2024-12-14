module.exports = {
  // 必要な設定をここに追加します
  reactStrictMode: true,  // 例: React Strict Mode を有効化
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'backet.skyblur.uk',
        pathname: '/**', // パスも指定可能
      },
    ],
  },
  images: {
    domains: ['cdn.bsky.app'],
  },
};