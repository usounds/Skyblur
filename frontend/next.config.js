import path from 'node:path';

const isE2ECoverage = process.env.E2E_COVERAGE === 'true';

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
  allowedDevOrigins: ['dev.skyblur.uk'],
  ...(isE2ECoverage
    ? {
        webpack: (config, { isServer }) => {
          if (!isServer) {
            config.module.rules.push({
              test: /\.[jt]sx?$/,
              include: [
                path.resolve(process.cwd(), 'src', 'app'),
                path.resolve(process.cwd(), 'src', 'components'),
              ],
              exclude: [
                /src\/lexicon/,
                /src\/types/,
                /__test__/,
                /\.(test|spec)\.[jt]sx?$/,
              ],
              use: {
                loader: 'babel-loader',
                options: {
                  babelrc: false,
                  configFile: false,
                  presets: ['next/babel'],
                  plugins: [
                    [
                      'istanbul',
                      {
                        cwd: process.cwd(),
                        extension: ['.ts', '.tsx'],
                      },
                    ],
                  ],
                  cacheDirectory: true,
                },
              },
            });
          }

          return config;
        },
      }
    : {}),
};

export default nextConfig;
