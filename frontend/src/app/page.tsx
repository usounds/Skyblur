import { cookies } from 'next/headers';
import { HomeContent } from './HomeContent';
import type { Locales } from '@/state/Locale';

export default async function Home() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get('lang')?.value || 'ja') as Locales;

  return <HomeContent initialLocale={locale} />;
}
