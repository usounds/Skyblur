/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'backet.skyblur.uk',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.bsky.app',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
