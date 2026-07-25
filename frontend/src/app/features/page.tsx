import { cookies, headers } from 'next/headers';
import { resolveLocale } from '@/logic/locale';
import { generateFeaturesMetadata, renderFeaturesPage } from './FeaturesPage';

async function getLocale() {
  const cookieStore = await cookies();
  const headersList = await headers();
  return resolveLocale(cookieStore.get('lang')?.value, headersList.get('accept-language'));
}

export async function generateMetadata() {
  const lang = await getLocale();
  return generateFeaturesMetadata(lang, {
    canonical: '/features',
    url: 'https://skyblur.uk/features',
  });
}

export default async function FeaturesPage() {
  const lang = await getLocale();
  return renderFeaturesPage(lang);
}
