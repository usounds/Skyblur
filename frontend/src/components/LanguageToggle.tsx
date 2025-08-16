"use client"
import { Locales, useLocaleStore } from "@/state/Locale";
import { ActionIcon } from '@mantine/core';
import React from "react";
import { IoLanguageSharp } from "react-icons/io5";

const LanguageToggle: React.FC = () => {
    const localeString = useLocaleStore((state) => state.locale); // 現在のlocale
    const setLocale = useLocaleStore((state) => state.setLocale); // localeを更新する関数

    const toggleLocale = () => {
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
        setLocale(newLocale);
    };

    return (
        <ActionIcon
            onClick={toggleLocale}
            variant="default"
            size="lg"
            aria-label="Toggle color scheme"
        >
            <IoLanguageSharp size={20} />
        </ActionIcon>
    )
};

export default LanguageToggle;
