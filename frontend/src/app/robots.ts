import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/xrpc/', '/console/'],
    },
    sitemap: 'https://skyblur.uk/sitemap.xml',
  };
}
