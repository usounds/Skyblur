import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: [
        '/robots.txt$',
        '/sitemap.xml$',
        '/ja$',
        '/ja/features$',
        '/ja/termofuse$',
        '/en$',
        '/en/features$',
        '/en/termofuse$',
      ],
      disallow: '/',
    },
    sitemap: 'https://skyblur.uk/sitemap.xml',
  };
}
