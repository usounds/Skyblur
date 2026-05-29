import en from "@/locales/en";
import ja from "@/locales/ja";
import type { Locales } from "@/state/Locale";
import { Anchor, Box, Text } from "@mantine/core";

interface RecommendedClientsProps {
    initialLocale: Locales;
}

interface ClientPlatform {
    label: string;
    href?: string;
}

interface RecommendedClient {
    name: string;
    href: string;
    platforms: ClientPlatform[];
}

export const RecommendedClients = ({ initialLocale }: RecommendedClientsProps) => {
    const locale = initialLocale === 'en' ? en : ja;
    const clients: RecommendedClient[] = [
        {
            name: locale.Home_TokimekiName,
            href: locale.Home_TokimekiUrl,
            platforms: [
                { label: "Web", href: locale.Home_TokimekiUrl },
                { label: "Android", href: locale.Home_TokimekiAndroidUrl },
            ],
        },
        {
            name: locale.Home_HagoromoName,
            href: locale.Home_HagoromoUrl,
            platforms: [
                { label: locale.Home_HagoromoPlatforms },
            ],
        },
        {
            name: "ZonePane",
            href: "https://zonepane.com/",
            platforms: [
                { label: "Android", href: "https://play.google.com/store/apps/details?id=com.zonepane" },
                { label: "iOS", href: "https://apps.apple.com/jp/app/zonepane-multi-sns-client/id6747976082" },
            ],
        },
        {
            name: locale.Home_HelicoName,
            href: locale.Home_HelicoUrl,
            platforms: [
                { label: locale.Home_HelicoPlatforms, href: locale.Home_HelicoDownloadUrl },
            ],
        },
    ];

    return (
        <Box className="mt-20 sm:mt-12 mx-4 text-center">
            <Text size="sm" c="dimmed" mb={8}>
                {locale.Home_RecommendedClients}
            </Text>
            <Box
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    gap: "12px 18px",
                }}
            >
                {clients.map((client) => (
                    <Box
                        key={client.name}
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 2,
                            minWidth: 92,
                        }}
                    >
                        <Anchor href={client.href} target="_blank" underline="hover" size="sm">
                            {client.name}
                        </Anchor>
                        {client.platforms.length > 0 && (
                            <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
                                {client.platforms.map((platform, platformIndex) => (
                                    <span key={platform.label}>
                                        {platformIndex > 0 && " / "}
                                        {platform.href ? (
                                            <Anchor href={platform.href} target="_blank" underline="hover" size="xs">
                                                {platform.label}
                                            </Anchor>
                                        ) : (
                                            platform.label
                                        )}
                                    </span>
                                ))}
                            </Text>
                        )}
                    </Box>
                ))}
            </Box>
        </Box>
    );
};
