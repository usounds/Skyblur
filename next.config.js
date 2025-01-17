module.exports = {
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