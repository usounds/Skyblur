import { cookies } from 'next/headers';
import { headers } from 'next/headers';
import { HomeContent } from './HomeContent';
import { resolveLocale } from '@/logic/locale';

export default async function Home() {
  const cookieStore = await cookies();
  const headersList = await headers();
  const locale = resolveLocale(cookieStore.get('lang')?.value, headersList.get('accept-language'));

  return <HomeContent initialLocale={locale} />;
}
