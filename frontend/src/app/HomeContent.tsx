"use client";
import { ResponsiveHeroDemo } from "@/components/HeroDemo";
import { RecommendedClients } from "@/components/RecommendedClients";
import { StartButton } from "@/components/StartButton";
import { Locales, useLocaleStore } from "@/state/Locale";
import { Container, SimpleGrid, Text, ThemeIcon, Title } from '@mantine/core';
import { Eye, EyeOff, Pencil } from 'lucide-react';
import { useEffect } from "react";
import en from "@/locales/en";
import ja from "@/locales/ja";
import classes from './FeaturesGrid.module.css';

interface FeatureProps {
    icon: React.FC<any>;
    title: React.ReactNode;
    description: React.ReactNode;
}

export function Feature({ icon: Icon, title, description }: FeatureProps) {
    return (
        <div>
            <ThemeIcon variant="light" size={40} radius={40}>
                <Icon size={18} strokeWidth={1.5} />
            </ThemeIcon>
            <Text mt="sm" mb={7} fw={500}>
                {title}
            </Text>
            <Text size="sm" c="dimmed" lh={1.6}>
                {description}
            </Text>
        </div>
    );
}

interface HomeContentProps {
    initialLocale: Locales;
}

export function HomeContent({ initialLocale }: HomeContentProps) {
    // サーバーから渡された言語で初期描画
    const locale = initialLocale === 'en' ? en : ja;
    const setLocale = useLocaleStore(state => state.setLocale);

    // Zustandストアを同期（クライアント側で他のコンポーネントが使えるように）
    useEffect(() => {
        setLocale(initialLocale);
    }, [initialLocale, setLocale]);

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
            <Title className={classes.title}>
                {locale.Home_WelcomeTitle}
            </Title>

            <Text size="sm" className={classes.description}>
                {locale.Home_WelcomeDescription}
            </Text>

            <ResponsiveHeroDemo />

            <StartButton />

            <SimpleGrid
                mt={60}
                cols={{ base: 1, sm: 2, md: 3 }}
                spacing={{ base: 'xl', md: 50 }}
                verticalSpacing={{ base: 'xl', md: 50 }}
            >
                {features}
            </SimpleGrid>

            <div className="h-8 sm:h-4" />

            <RecommendedClients initialLocale={initialLocale} />
        </Container>
    );
}
