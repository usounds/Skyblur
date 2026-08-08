import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const alternates = {
    home: {
      ja: 'https://skyblur.uk/ja',
      en: 'https://skyblur.uk/en',
    },
    features: {
      ja: 'https://skyblur.uk/ja/features',
      en: 'https://skyblur.uk/en/features',
    },
    termofuse: {
      ja: 'https://skyblur.uk/ja/termofuse',
      en: 'https://skyblur.uk/en/termofuse',
    },
  };

  return [
    {
      url: 'https://skyblur.uk/ja',
      changeFrequency: 'monthly',
      priority: 1,
      alternates: {
        languages: alternates.home,
      },
    },
    {
      url: 'https://skyblur.uk/en',
      changeFrequency: 'monthly',
      priority: 1,
      alternates: {
        languages: alternates.home,
      },
    },
    {
      url: 'https://skyblur.uk/ja/features',
      changeFrequency: 'monthly',
      priority: 0.8,
      alternates: {
        languages: alternates.features,
      },
    },
    {
      url: 'https://skyblur.uk/en/features',
      changeFrequency: 'monthly',
      priority: 0.8,
      alternates: {
        languages: alternates.features,
      },
    },
    {
      url: 'https://skyblur.uk/ja/termofuse',
      changeFrequency: 'yearly',
      priority: 0.5,
      alternates: {
        languages: alternates.termofuse,
      },
    },
    {
      url: 'https://skyblur.uk/en/termofuse',
      changeFrequency: 'yearly',
      priority: 0.5,
      alternates: {
        languages: alternates.termofuse,
      },
    }
  ];
}
