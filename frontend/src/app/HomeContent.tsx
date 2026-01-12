"use client";
import PageLoading from "@/components/PageLoading";
import { RecommendedClients } from "@/components/RecommendedClients";
import { useLocale } from "@/state/Locale";
import { useXrpcAgentStore } from "@/state/XrpcAgent";
import { Button, Container, SimpleGrid, Text, ThemeIcon, Title } from '@mantine/core';
import { IconEye, IconEyeOff, IconPencil } from '@tabler/icons-react';
import { Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from "react";
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
                <Icon size={18} stroke={1.5} />
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

export function HomeContent() {
    const { localeData: locale } = useLocale();
    const setIsLoginModalOpened = useXrpcAgentStore((state) => state.setIsLoginModalOpened);
    const router = useRouter();
    const did = useXrpcAgentStore((state) => state.did);
    const isSessionChecked = useXrpcAgentStore((state) => state.isSessionChecked);
    const [isLoading, setIsLoading] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);

        const checkSession = async () => {
            await useXrpcAgentStore.getState().checkSession();
        };
        checkSession();
    }, []);

    if (!isMounted) return <PageLoading />;

    const handleStart = async () => {
        setIsLoading(true);


        try {
            // セッションチェックが終わっていない場合はまずチェック
            let currentDid = did;
            if (!isSessionChecked) {
                const result = await useXrpcAgentStore.getState().checkSession();
                currentDid = result.did;
            }

            if (currentDid) {
                // 認証済みならコンソールへ
                router.push('/console');
            } else {
                // 未認証ならログインモーダルを表示
                setIsLoginModalOpened(true);
            }
        } catch (err) {
            console.error("Failed to check session", err);
            setIsLoginModalOpened(true);
        } finally {
            setIsLoading(false);
        }
    };

    const features = [
        {
            icon: IconPencil,
            title: locale.Home_Landing001Title,
            description: locale.Home_Landing001Descrtption
        },
        {
            icon: IconEyeOff,
            title: locale.Home_Landing002Title,
            description: locale.Home_Landing002Descrtption
        },
        {
            icon: IconEye,
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

            <div className="flex justify-center mt-10 mb-12">
                <Button
                    variant="outline" size="md" radius="lg"
                    onClick={handleStart}
                    loading={isLoading}
                    leftSection={<Sparkles size={24} />}
                    className="px-10 h-16 text-lg"
                >
                    {locale.Landing_StartButton || 'Start'}
                </Button>
            </div>

            <SimpleGrid
                mt={60}
                cols={{ base: 1, sm: 2, md: 3 }}
                spacing={{ base: 'xl', md: 50 }}
                verticalSpacing={{ base: 'xl', md: 50 }}
            >
                {features}
            </SimpleGrid>

            <RecommendedClients />
        </Container>
    );
}
