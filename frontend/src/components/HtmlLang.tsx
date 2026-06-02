"use client";

import { useEffect } from "react";
import { useLocale } from "@/state/Locale";
import type { Locales } from "@/state/Locale";

export default function HtmlLang({ initialLocale }: { initialLocale: Locales }) {
  const { locale } = useLocale();
  const activeLocale = locale ?? initialLocale;

  useEffect(() => {
    document.documentElement.lang = activeLocale;
    document.documentElement.setAttribute("translate", "no");
  }, [activeLocale]);

  return null;
}
