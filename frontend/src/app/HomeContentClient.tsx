"use client";

import { ResponsiveHeroDemo } from "@/components/HeroDemo";
import { RecommendedClients } from "@/components/RecommendedClients";
import { StartButton } from "@/components/StartButton";
import en from "@/locales/en";
import ja from "@/locales/ja";
import type { Locales } from "@/state/Locale";
import { useLocaleStore } from "@/state/Locale";
import { Anchor, Container, SimpleGrid, Text, ThemeIcon, Title } from '@mantine/core';
import { Eye, EyeOff, Pencil } from 'lucide-react';
import Link from "next/link";
import { useEffect, useState } from "react";
import classes from './FeaturesGrid.module.css';

type LocaleData = typeof en;

interface FeatureProps {
    icon: React.FC<any>;
    title: React.ReactNode;
    description: React.ReactNode;
}

function Feature({ icon: Icon, title, description }: FeatureProps) {
    return (
        <div>
            <ThemeIcon variant="light" size={40} radius={40}>
                <Icon size={18} strokeWidth={1.5} />
            </ThemeIcon>
            <Text mt="sm" mb={7} fw={500}>
                {title}
            </Text>
            <Text size="sm" style={{ color: 'light-dark(var(--mantine-color-gray-7), var(--mantine-color-gray-4))' }} lh={1.6}>
                {description}
            </Text>
        </div>
    );
}

interface HomeContentClientProps {
    initialLocale: Locales;
    initialLocaleData: LocaleData;
}

export function HomeContentClient({ initialLocale, initialLocaleData }: HomeContentClientProps) {
    const storeLocale = useLocaleStore((state) => state.locale);
    const [isLocaleHydrated, setIsLocaleHydrated] = useState(false);
    const locale = isLocaleHydrated ? (storeLocale === 'en' ? en : ja) : initialLocaleData;

    useEffect(() => {
        setIsLocaleHydrated(true);
    }, []);

    const features = [
        {
            icon: Pencil,
            title: locale.Home_Landing001Title,
            description: locale.Home_Landing001Descrtption
        },
        {
            icon: EyeOff,
            title: locale.Home_Landing002Title,
            description: locale.Home_Landing002Descrtption
        },
        {
            icon: Eye,
            title: locale.Home_Landing003Title,
            description: locale.Home_Landing003Descrtption
        }
    ].map((feature, index) => <Feature {...feature} key={index} />);

    return (
        <Container className={classes.wrapper}>
            <div>
                <Title className={classes.title}>
                    {locale.Home_WelcomeTitle}
                </Title>
            </div>

            <div>
                <Text size="sm" className={classes.description}>
                    {locale.Home_WelcomeDescription}
                </Text>
            </div>

            <div>
                <ResponsiveHeroDemo locale={locale} />
            </div>

            <div>
                <StartButton initialLocale={initialLocale} />
            </div>

            <div className={classes.featuresLinkWrap}>
                <Anchor component={Link} href="/features" size="sm" className={classes.featuresLink}>
                    {locale.Home_FeaturesLink}
                </Anchor>
            </div>

            <div className={classes.fadeIn} style={{ animationDelay: '0.4s' }}>
                <SimpleGrid
                    mt={60}
                    cols={{ base: 1, sm: 2, md: 3 }}
                    spacing={{ base: 'xl', md: 50 }}
                    verticalSpacing={{ base: 'xl', md: 50 }}
                >
                    {features}
                </SimpleGrid>
            </div>

            <div className="h-8 sm:h-4" />

            <div className={classes.fadeIn} style={{ animationDelay: '0.5s' }}>
                <RecommendedClients initialLocale={initialLocale} />
            </div>
        </Container>
    );
}
