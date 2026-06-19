"use client";

import { useEffect } from "react";
import { useLocale, useLocaleStore } from "@/state/Locale";
import type { Locales } from "@/state/Locale";

export default function HtmlLang({ initialLocale }: { initialLocale: Locales }) {
  const { locale } = useLocale();
  const initLocale = useLocaleStore((state) => state.initLocale);
  const activeLocale = locale ?? initialLocale;

  useEffect(() => {
    initLocale(initialLocale);
  }, [initLocale, initialLocale]);

  useEffect(() => {
    document.documentElement.lang = activeLocale;
    document.documentElement.setAttribute("translate", "no");
  }, [activeLocale]);

  return null;
}
