import { HomeContent } from './HomeContent';
import type { Locales } from '@/state/Locale';
import en from '@/locales/en';
import ja from '@/locales/ja';

interface HomePageProps {
  locale: Locales;
  url: string;
}

export function HomePage({ locale, url }: HomePageProps) {
  const langDescription = locale === 'ja' ? ja.Common_OGDescription : en.Common_OGDescription;
  const langName = locale === 'ja' ? ja.Common_Title : en.Common_Title;

  const f1Title = locale === 'ja' ? ja.Home_Landing001Title : en.Home_Landing001Title;
  const f1Desc = locale === 'ja' ? ja.Home_Landing001Descrtption : en.Home_Landing001Descrtption;

  const f2Title = locale === 'ja' ? ja.Home_Landing002Title : en.Home_Landing002Title;
  const f2Desc = locale === 'ja' ? ja.Home_Landing002Descrtption : en.Home_Landing002Descrtption;

  const f3Title = locale === 'ja' ? ja.Home_Landing003Title : en.Home_Landing003Title;
  const f3Desc = locale === 'ja' ? ja.Home_Landing003Descrtption : en.Home_Landing003Descrtption;

  const appFeatureList = [
    `${f1Title}: ${f1Desc}`,
    `${f2Title}: ${f2Desc}`,
    `${f3Title}: ${f3Desc}`
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": langName,
    "url": url,
    "description": langDescription,
    "inLanguage": locale,
    "applicationCategory": "SocialNetworkingApplication",
    "operatingSystem": "All",
    "browserRequirements": "Requires JavaScript. Requires HTML5.",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "author": {
      "@type": "Person",
      "name": "usounds.work",
      "url": "https://bsky.app/profile/usounds.work"
    },
    "featureList": appFeatureList
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomeContent initialLocale={locale} />
    </>
  );
}
