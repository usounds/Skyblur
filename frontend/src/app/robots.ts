import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  // /post/ and /profile/ stay crawlable on purpose: they are noindex, and
  // blocking them hid that directive while external links got them indexed.
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/console/',
        '/settings/',
        '/api/',
        '/xrpc/',
      ],
    },
    sitemap: 'https://skyblur.uk/sitemap.xml',
  };
}
