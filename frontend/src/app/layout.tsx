import Header from "@/components/Header";
import PageLoading from "@/components/PageLoading";
import { Suspense } from "react";
import { ColorSchemeScript, mantineHtmlProps, Text } from '@mantine/core';
import '@mantine/core/styles.css';
import { Notifications } from "@mantine/notifications";
import '@mantine/notifications/styles.css';
import type { Metadata } from "next";
import "./globals.css";
import Script from "next/script"
import { cookies, headers } from "next/headers";
import { BlueskyIcon, GithubIcon } from "@/components/Icons";
import en from "@/locales/en";
import ja from "@/locales/ja";
import { Viewport } from "next";
import { Inter } from "next/font/google";
import { detectLocaleFromAcceptLanguage, resolveLocale } from "@/logic/locale";
import { AppMantineProvider } from "@/components/AppMantineProvider";

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-inter",
  display: "optional",
});

export async function generateMetadata() {
  const cookieStore = await cookies();
  const headersList = await headers();

  const langCookie = cookieStore.get('lang')?.value;
  const acceptLanguage = headersList.get('accept-language');
  const lang = resolveLocale(langCookie, acceptLanguage);
  const isHybridFallback = !langCookie && !detectLocaleFromAcceptLanguage(acceptLanguage);

  const locale = lang === 'en' ? en : ja;
  const description = isHybridFallback
    ? `${ja.Common_OGDescription} / ${en.Common_OGDescription}`
    : locale.Common_OGDescription;

  const title = locale.Common_Title;

  return {
    metadataBase: new URL('https://skyblur.uk'),
    title: title,
    description: locale.Common_Description,
    openGraph: {
      title: title,
      description: description,
      siteName: "Skyblur",
      locale: lang === 'ja' ? 'ja_JP' : 'en_US',
      type: 'website',
      images: ['/ogp.png'],
    },
    twitter: {
      card: 'summary_large_image',
      title: title,
      description: description,
      images: ['/ogp.png'],
    },
  };
}

import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const headersList = await headers();
  const lang = resolveLocale(cookieStore.get('lang')?.value, headersList.get('accept-language'));

  return (
    <html {...mantineHtmlProps} lang={lang} className={`${inter.variable} notranslate`} suppressHydrationWarning>
      <body>
        <Script
          id="console-back-forward-recovery"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
(function () {
  function shouldRecoverConsoleFallback() {
    if (!location.pathname.startsWith("/console")) return false;
    if (!document.body || !document.body.innerText.includes("Loading...")) return false;
    return !document.querySelector("[data-nextjs-scroll-focus-boundary]");
  }

  window.addEventListener("pageshow", function (event) {
    var isBackForward = event.persisted;

    try {
      isBackForward = isBackForward || performance.getEntriesByType("navigation").some(function (entry) {
        return entry.type === "back_forward";
      });
    } catch (_) {}

    if (!isBackForward) return;

    window.setTimeout(function () {
      if (!shouldRecoverConsoleFallback()) return;

      var reloadKey = "skyblur.back-forward-reload:" + location.href;
      if (sessionStorage.getItem(reloadKey) === "1") return;

      sessionStorage.setItem(reloadKey, "1");
      location.reload();
    }, 100);
  });
})();
            `,
          }}
        />
        <ServiceWorkerRegister />
        <ColorSchemeScript />
        <AppMantineProvider>
          <Notifications position="top-right" zIndex={1000} />
          <Header />
          <main>
            <Suspense fallback={<PageLoading />}>
              {children}
            </Suspense>
          </main>
          <footer
            className="flex gap-6 flex-wrap items-center justify-center py-4 mt-4"
            style={{ color: 'var(--mantine-color-dimmed)' }}
          >
            <div className="text-center mb-4">
              <div className="mb-2">
                <Text size="sm" c="inherit">Developed by usounds.work</Text>
              </div>
              <div className="flex justify-center space-x-4 mb-4">
                <a
                  href="https://bsky.app/profile/skyblur.uk"
                  target="_blank"
                  className="transition duration-100 hover:opacity-80"
                  aria-label="Bluesky"
                >
                  <BlueskyIcon size={20} />
                </a>
                <a
                  href="https://github.com/usounds/Skyblur"
                  target="_blank"
                  className="transition duration-100 hover:opacity-80"
                  aria-label="GitHub"
                >
                  <GithubIcon size={20} />
                </a>
              </div>
              <div className="flex justify-center">
                <a href="https://www.buymeacoffee.com/usounds" target="_blank" className="transition duration-100 hover:opacity-80">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
                    alt="Buy Me A Coffee"
                    width={545}
                    height={153}
                    style={{ height: '40px', width: 'auto' }}
                  />
                </a>
              </div>
            </div>

          </footer>
        </AppMantineProvider>
        <Script
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon='{"token": "300d80e7a0bd450f823bfd0231dc3ce9"}'
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
