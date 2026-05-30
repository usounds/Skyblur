import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://skyblur.uk',
      changeFrequency: 'monthly',
      priority: 1
    },
    {
      url: 'https://skyblur.uk/features',
      changeFrequency: 'monthly',
      priority: 0.8
    },
    {
      url: 'https://skyblur.uk/termofuse',
      changeFrequency: 'yearly',
      priority: 0.5
    }
  ];
}
