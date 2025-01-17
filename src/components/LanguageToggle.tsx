import { Locales, useLocaleStore } from "@/state/Locale";
import React from "react";
import { IoLanguageSharp } from "react-icons/io5";

const LanguageToggle: React.FC = () => {
    const localeString = useLocaleStore((state) => state.locale); // 現在のlocale
    const setLocale = useLocaleStore((state) => state.setLocale); // localeを更新する関数

    const toggleLocale = () => {
        // ja <-> en を切り替える
        const newLocale: Locales = localeString === "ja" ? "en" : "ja";
        setLocale(newLocale);
    };

    return (
        <div className="flex items-center">
            <button
                onClick={toggleLocale}
            >
                <IoLanguageSharp size={20} color="white" />
            </button>
        </div>
    );
};

export default LanguageToggle;
