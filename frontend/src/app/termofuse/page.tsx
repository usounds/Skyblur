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

  const pageTitle = lang === 'ja' ? "利用規約 - Skyblur" : "Terms of Use - Skyblur";
  const pageDescription = lang === 'ja'
    ? "Skyblurの利用規約です。当サービスを利用する上での条件を定義しています。"
    : "Terms of Use / Terms of Service for Skyblur, defining the conditions for using our service.";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": pageTitle,
    "url": "https://skyblur.uk/termofuse",
    "description": pageDescription,
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
    <main >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="">
        <Container size="md" className="py-10">
          <TermsContent content={content} />
        </Container>
      </section>
    </main >
  );
}
