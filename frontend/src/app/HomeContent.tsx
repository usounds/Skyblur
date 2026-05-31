import { HomeContentClient } from "@/app/HomeContentClient";
import en from "@/locales/en";
import ja from "@/locales/ja";
import type { Locales } from "@/state/Locale";

interface HomeContentProps {
    initialLocale: Locales;
}

export function HomeContent({ initialLocale }: HomeContentProps) {
    const initialLocaleData = initialLocale === 'en' ? en : ja;

    return (
        <HomeContentClient
            initialLocale={initialLocale}
            initialLocaleData={initialLocaleData}
        />
    );
}
