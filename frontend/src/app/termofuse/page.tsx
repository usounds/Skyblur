import { cookies, headers } from 'next/headers';
import { permanentRedirect } from 'next/navigation';
import { resolveLocale } from '@/logic/locale';

export default async function TermsOfUsePage() {
  const cookieStore = await cookies();
  const headersList = await headers();
  const locale = resolveLocale(cookieStore.get('lang')?.value, headersList.get('accept-language'));
  permanentRedirect(`/${locale}/termofuse`);
}
