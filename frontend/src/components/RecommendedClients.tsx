import en from "@/locales/en";
import ja from "@/locales/ja";
import type { Locales } from "@/state/Locale";
import { Anchor, Box, Text } from "@mantine/core";
import classes from "./RecommendedClients.module.css";

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
                { label: "Android", href: locale.Home_TokimekiAndroidUrl },
                { label: "Web", href: locale.Home_TokimekiUrl },
            ],
        },
        {
            name: locale.Home_HagoromoName,
            href: locale.Home_HagoromoUrl,
            platforms: [
                { label: locale.Home_HagoromoPlatforms, href: locale.Home_HagoromoUrl },
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
            <Text size="sm" style={{ color: 'light-dark(var(--mantine-color-gray-7), var(--mantine-color-gray-4))' }} mb={8}>
                {locale.Home_RecommendedClients}
            </Text>
            <Box className={classes.clientsGrid}>
                {clients.map((client) => (
                    <Box
                        key={client.name}
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 6,
                        }}
                    >
                        <Anchor
                            href={client.href}
                            target="_blank"
                            underline="never"
                            size="sm"
                            className={classes.clientLink}
                        >
                            {client.name}
                        </Anchor>
                        {client.platforms.length > 0 && (
                            <Text size="xs" style={{ color: 'light-dark(var(--mantine-color-gray-7), var(--mantine-color-gray-4))', whiteSpace: "nowrap" }}>
                                {client.platforms.map((platform, platformIndex) => (
                                    <span key={platform.label}>
                                        {platformIndex > 0 && " / "}
                                        {platform.href ? (
                                            <Anchor
                                                href={platform.href}
                                                target="_blank"
                                                underline="never"
                                                size="xs"
                                                className={classes.platformLink}
                                            >
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
