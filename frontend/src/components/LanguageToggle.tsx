"use client"
import { Locales, useLocaleStore } from "@/state/Locale";
import { ActionIcon } from '@mantine/core';
import React from "react";
import { Languages } from 'lucide-react';
import { useRouter } from 'next/navigation';

const LanguageToggle: React.FC = () => {
    const localeString = useLocaleStore((state) => state.locale); // 現在のlocale
    const setLocale = useLocaleStore((state) => state.setLocale); // localeを更新する関数


    const router = useRouter();

    const toggleLocale = () => {
        // 新しい言語を決定
        const newLocale: Locales =
            !localeString
                ? (typeof window !== "undefined" &&
                    typeof navigator !== "undefined" &&
                    navigator.language.startsWith("ja")
                    ? "en"
                    : "ja")
                : localeString === "ja"
                    ? "en"
                    : "ja";

        // 状態を更新
        setLocale(newLocale);

        // URL にクエリパラメータを追加
        const currentUrl = window.location.pathname;
        router.replace(`${currentUrl}?lang=${newLocale}`);
    };

    return (
        <ActionIcon
            onClick={toggleLocale}
            variant="default"
            size="lg"
            aria-label="Toggle color scheme"
        >
            <Languages size={20} />
        </ActionIcon>
    )
};

export default LanguageToggle;
