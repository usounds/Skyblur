import en from "@/locales/en";
import ja from "@/locales/ja";
import type { Locales } from "@/state/Locale";
import { Text, Anchor, Box } from "@mantine/core";

interface RecommendedClientsProps {
    initialLocale: Locales;
}

export const RecommendedClients = ({ initialLocale }: RecommendedClientsProps) => {
    const locale = initialLocale === 'en' ? en : ja;

    return (
        <Box className="mt-20 sm:mt-12 mx-4 text-center">
            <Text size="sm" c="dimmed" mb={8}>
                {locale.Home_RecommendedClients}
            </Text>
            <Box style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px' }}>
                <Anchor href="https://tokimeki.blue/" target="_blank" underline="hover" size="sm">
                    TOKIMEKI
                </Anchor>
                <Text size="sm" c="dimmed">|</Text>
                <Anchor href={locale.Home_HagoromoUrl} target="_blank" underline="hover" size="sm">
                    {locale.Home_HagoromoName}
                </Anchor>
                <Text size="sm" c="dimmed">|</Text>
                <Text size="sm" c="dimmed">
                    ZonePane (
                    <Anchor href="https://play.google.com/store/apps/details?id=com.zonepane" target="_blank" underline="hover" size="sm">
                        Android
                    </Anchor>
                    {" / "}
                    <Anchor href="https://apps.apple.com/jp/app/zonepane-multi-sns-client/id6747976082" target="_blank" underline="hover" size="sm">
                        iOS
                    </Anchor>
                    )
                </Text>
            </Box>
        </Box>
    );
};
