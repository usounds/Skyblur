import fs from 'fs';
import path from 'path';
import { cookies } from 'next/headers';
import { Container } from '@mantine/core';
import TermsContent from './TermsContent';

export default async function Home() {
  const cookieStore = await cookies();
  const locale = cookieStore.get('lang')?.value || 'ja';

  // Decide which file to load. Safe to default to 'ja' if unknown.
  const lang = (locale === 'en' || locale === 'ja') ? locale : 'ja';
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
