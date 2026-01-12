import Header from "@/components/Header";
import PageLoading from "@/components/PageLoading";
import { Suspense } from "react";
import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from '@mantine/core';
import '@mantine/core/styles.css';
import { Notifications } from "@mantine/notifications";
import '@mantine/notifications/styles.css';
import type { Metadata } from "next";
import "./globals.css";
import Script from "next/script"
import { BlueskyIcon, GithubIcon } from "@/components/Icons";

export const metadata: Metadata = {
  title: "Skyblur",
  description: "伏字を使った投稿ができます / You can post with blur.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html {...mantineHtmlProps} className="notranslate" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                const getCookie = (name) => {
                  const value = "; " + document.cookie;
                  const parts = value.split("; " + name + "=");
                  if (parts.length === 2) return parts.pop().split(";").shift();
                };
                const lang = getCookie('lang') || 'ja';
                document.documentElement.lang = lang;
              } catch (e) {
                document.documentElement.lang = 'ja';
              }
            })();
          `
        }} />
      </head>
      <body>
        <ColorSchemeScript />
        <MantineProvider>
          <Notifications position="top-right" zIndex={1000} />
          <Header />
          <Suspense fallback={<PageLoading />}>
            {children}
          </Suspense>
          <footer className="flex gap-6 flex-wrap items-center justify-center py-4 mt-10">
            <div className="text-center mb-4">
              <div className="mb-2">
                Developed by usounds.work
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
