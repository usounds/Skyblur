import fs from 'fs';
import path from 'path';
import { cookies } from 'next/headers';
import { headers } from 'next/headers';
import { Container } from '@mantine/core';
import TermsContent from './TermsContent';
import { resolveLocale } from '@/logic/locale';

export default async function Home() {
  const cookieStore = await cookies();
  const headersList = await headers();
  const lang = resolveLocale(cookieStore.get('lang')?.value, headersList.get('accept-language'));
  const filePath = path.join(process.cwd(), 'src', 'locales', 'terms', `${lang}.md`);

  let content = '';
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    console.error('Failed to read terms file', e);
    content = '# Error\n\nFailed to load Terms of Service.';
  }

  return (
    <main >
      <section className="">
        <Container size="md" className="py-10">
          <TermsContent content={content} />
        </Container>
      </section>
    </main >
  );
}
