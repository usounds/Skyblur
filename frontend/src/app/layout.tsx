import Header from "@/components/Header";
import PageLoading from "@/components/PageLoading";
import { Suspense } from "react";
import { ColorSchemeScript, MantineProvider, mantineHtmlProps, Text } from '@mantine/core';
import '@mantine/core/styles.css';
import { Notifications } from "@mantine/notifications";
import '@mantine/notifications/styles.css';
import type { Metadata } from "next";
import "./globals.css";
import Script from "next/script"
import { cookies } from "next/headers";
import { BlueskyIcon, GithubIcon } from "@/components/Icons";
import en from "@/locales/en";
import ja from "@/locales/ja";

export async function generateMetadata() {
  const cookieStore = await cookies();
  const lang = cookieStore.get('lang')?.value || 'ja';
  const locale = lang === 'en' ? en : ja;

  return {
    title: locale.Common_Title,
    description: locale.Common_Description,
    openGraph: {
      title: locale.Common_Title,
      description: locale.Common_Description,
      siteName: "Skyblur",
      locale: lang === 'ja' ? 'ja_JP' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: locale.Common_Title,
      description: locale.Common_Description,
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const lang = cookieStore.get('lang')?.value || 'ja';

  return (
    <html {...mantineHtmlProps} lang={lang} className="notranslate" suppressHydrationWarning>
      <head>
      </head>
      <body>
        <ColorSchemeScript />
        <MantineProvider>
          <Notifications position="top-right" zIndex={1000} />
          <Header />
          <Suspense fallback={<PageLoading />}>
            {children}
          </Suspense>
          <footer className="flex gap-6 flex-wrap items-center justify-center py-4 mt-4 text-gray-400">
            <div className="text-center mb-4">
              <div className="mb-2">
                <Text size="sm" c="dimmed">Developed by usounds.work</Text>
              </div>
              <div className="flex justify-center space-x-4 mb-4">
                <a
                  href="https://bsky.app/profile/skyblur.uk"
                  target="_blank"
                  className="transition duration-100 "
                >
                  <BlueskyIcon size={20} />
                </a>
                <a
                  href="https://github.com/usounds/Skyblur"
                  target="_blank"
                  className=" transition duration-100"
                >
                  <GithubIcon size={20} />
                </a>
              </div>
              <div className="flex justify-center">
                <a href="https://www.buymeacoffee.com/usounds" target="_blank" className="transition duration-100 hover:opacity-80">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style={{ height: '40px', width: 'auto' }} />
                </a>
              </div>
            </div>

          </footer>
        </MantineProvider>
        <Script
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon='{"token": "300d80e7a0bd450f823bfd0231dc3ce9"}'
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
