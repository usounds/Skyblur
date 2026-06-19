import { cookies, headers } from 'next/headers';
import { resolveLocale } from '@/logic/locale';
import { generateTermsMetadata, renderTermsPage } from './TermsPage';

async function getLocale() {
  const cookieStore = await cookies();
  const headersList = await headers();
  return resolveLocale(cookieStore.get('lang')?.value, headersList.get('accept-language'));
}

export async function generateMetadata() {
  const lang = await getLocale();
  return generateTermsMetadata(lang, {
    canonical: '/termofuse',
    url: 'https://skyblur.uk/termofuse',
  });
}

export default async function Home() {
  const lang = await getLocale();
  return renderTermsPage(lang);
}
