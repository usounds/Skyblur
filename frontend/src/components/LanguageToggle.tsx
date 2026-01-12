"use client"
import { Locales, useLocale, useLocaleStore } from "@/state/Locale";
import { ActionIcon } from '@mantine/core';
import React from "react";
import { Languages } from 'lucide-react';
import { useRouter } from 'next/navigation';

const LanguageToggle: React.FC = () => {
    const { locale: localeString } = useLocale();
    const setLocale = useLocaleStore(state => state.setLocale);
    const router = useRouter();

    const toggleLocale = () => {
        const newLocale: Locales = localeString === "ja" ? "en" : "ja";
        setLocale(newLocale);
        router.refresh();
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
