"use client"
import { Locales, useLocale } from "@/state/Locale";
import { ActionIcon } from '@mantine/core';
import React from "react";
import { Languages } from 'lucide-react';
import { useRouter } from 'next/navigation';

const LanguageToggle: React.FC = () => {
    const { locale: localeString } = useLocale();
    const router = useRouter();

    const toggleLocale = () => {
        // 新しい言語を決定
        const newLocale: Locales = localeString === "ja" ? "en" : "ja";

        // URL にクエリパラメータを追加 (状態更新はURL変更で行われる)
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
