import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/console/',
        '/settings/',
        '/api/',
        '/xrpc/',
        '/post/',
        '/profile/',
      ],
    },
    sitemap: 'https://skyblur.uk/sitemap.xml',
  };
}
