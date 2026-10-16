import fs from 'fs';
import path from 'path';
import { Container } from '@mantine/core';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { serializeJsonLd } from '@/logic/serializeJsonLd';
import TermsContent from './TermsContent';
import type { Locales } from '@/state/Locale';

function getTermsCopy(lang: Locales) {
  return {
    pageTitle: lang === 'ja' ? "利用規約 - Skyblur" : "Terms of Use - Skyblur",
    pageDescription: lang === 'ja'
      ? "Skyblurの利用規約です。当サービスを利用する上での条件を定義しています。"
      : "Terms of Use / Terms of Service for Skyblur, defining the conditions for using our service.",
  };
}

type TermsMetadataOptions = {
  canonical?: string;
  url?: string;
};

export function generateTermsMetadata(lang: Locales, options: TermsMetadataOptions = {}): Metadata {
  const { pageTitle, pageDescription } = getTermsCopy(lang);
  const canonical = options.canonical ?? `/${lang}/termofuse`;
  const url = options.url ?? `https://skyblur.uk/${lang}/termofuse`;

  return {
    title: pageTitle,
    description: pageDescription,
    alternates: {
      canonical,
      languages: {
        ja: '/ja/termofuse',
        en: '/en/termofuse',
      }
    },
    openGraph: {
      title: pageTitle,
      description: pageDescription,
      url,
      siteName: 'Skyblur',
      locale: lang === 'ja' ? 'ja_JP' : 'en_US',
      type: 'website',
      images: ['/ogp.png']
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description: pageDescription,
      images: ['/ogp.png']
    }
  };
}

export async function renderTermsPage(lang: Locales) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const baseFull = path.resolve(process.cwd(), 'src', 'locales', 'terms');
  const filePath = path.join(baseFull, `${lang}.md`);
  const rel = path.relative(baseFull, filePath);
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new Error('Invalid file path');
  }

  let content = '';
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    console.error('Failed to read terms file', e);
    content = '# Error\n\nFailed to load Terms of Service.';
  }

  const { pageTitle, pageDescription } = getTermsCopy(lang);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": pageTitle,
    "url": `https://skyblur.uk/${lang}/termofuse`,
    "description": pageDescription,
    "inLanguage": lang,
    "isPartOf": {
      "@type": "WebSite",
      "name": "Skyblur",
      "url": "https://skyblur.uk"
    },
    "about": {
      "@type": "Thing",
      "name": "Terms of Service"
    },
    "text": content
  };

  return (
    <>
      <script
        nonce={nonce}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <section className="">
        <Container size="md" className="py-10">
          <TermsContent content={content} />
        </Container>
      </section>
    </>
  );
}
