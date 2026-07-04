import { cookies } from 'next/headers';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { HomePage } from './HomePage';
import { resolveLocale } from '@/logic/locale';
import en from '@/locales/en';
import ja from '@/locales/ja';

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const headersList = await headers();
  const locale = resolveLocale(cookieStore.get('lang')?.value, headersList.get('accept-language'));
  const copy = locale === 'ja' ? ja : en;

  return {
    title: copy.Common_Title,
    description: copy.Common_Description,
    alternates: {
      canonical: '/',
      languages: {
        ja: '/ja',
        en: '/en',
      }
    },
    openGraph: {
      title: copy.Common_Title,
      description: copy.Common_OGDescription,
      url: 'https://skyblur.uk',
      siteName: 'Skyblur',
      locale: locale === 'ja' ? 'ja_JP' : 'en_US',
      type: 'website',
      images: ['/ogp.png'],
    },
    twitter: {
      card: 'summary_large_image',
      title: copy.Common_Title,
      description: copy.Common_OGDescription,
      images: ['/ogp.png'],
    },
  };
}

export default async function Home() {
  const cookieStore = await cookies();
  const headersList = await headers();
  const locale = resolveLocale(cookieStore.get('lang')?.value, headersList.get('accept-language'));

  return <HomePage locale={locale} url="https://skyblur.uk" />;
}
