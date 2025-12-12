"use client";

import { useLocaleStore } from "@/state/Locale";

export default function HtmlLang() {
  const locale = useLocaleStore((s) => s.locale) ?? "en";

  return <script dangerouslySetInnerHTML={{
    __html: `document.documentElement.lang = "${locale}";`
  }} />;
}
