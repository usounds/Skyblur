"use client";

import { useLocale } from "@/state/Locale";

export default function HtmlLang() {
  const { locale } = useLocale();

  return <script dangerouslySetInnerHTML={{
    __html: `document.documentElement.lang = "${locale}";`
  }} />;
}
