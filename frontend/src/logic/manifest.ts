import { NextResponse } from 'next/server';

export const enManifest = {
  id: '/',
  lang: 'en',
  name: 'Skyblur',
  short_name: 'Skyblur',
  description: 'Masked and visibility-restricted posting service for Bluesky. Securely share posts with followers, selected lists, or password protection. Powered by atproto.',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: '#ffffff',
  theme_color: '#ffffff',
  icons: [
    {
      src: '/skyblur.png',
      sizes: 'any',
      type: 'image/png',
    },
  ],
  shortcuts: [
    {
      name: 'Create post',
      short_name: 'Post',
      description: 'Create a new Skyblur post',
      url: '/console/posts/new',
    },
  ],
};

export const jaManifest = {
  id: '/',
  lang: 'ja',
  name: 'Skyblur',
  short_name: 'Skyblur',
  description: 'Bluesky向けの伏せ字投稿・限定公開サービス。伏せ字はネタバレにも使え、フォロワー・リスト・パスワード限定公開などの機能を安全に利用できます。atprotoの仕組みを利用しています。',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: '#ffffff',
  theme_color: '#ffffff',
  icons: [
    {
      src: '/skyblur.png',
      sizes: 'any',
      type: 'image/png',
    },
  ],
  shortcuts: [
    {
      name: '新規投稿',
      short_name: '投稿',
      description: 'Skyblurで新しい投稿を作成します',
      url: '/console/posts/new',
    },
  ],
};

export function createManifestResponse(manifest: typeof enManifest) {
  return new NextResponse(JSON.stringify(manifest), {
    status: 200,
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=86400',
      'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
