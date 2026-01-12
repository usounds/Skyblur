"use client";
import { useLocale } from "@/state/Locale";
import { useXrpcAgentStore } from "@/state/XrpcAgent";
import { IconPencil, IconEyeOff, IconEye } from '@tabler/icons-react';
import { Button, Title, Container, Text, SimpleGrid, ThemeIcon } from '@mantine/core';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from "react";
import { Sparkles } from 'lucide-react';
import { notifications } from '@mantine/notifications';
import Loading from "@/components/Loading";
import { RecommendedClients } from "@/components/RecommendedClients";
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
    const { locale: currentLocale, localeData: locale } = useLocale();
    const setIsLoginModalOpened = useXrpcAgentStore((state) => state.setIsLoginModalOpened);
    const setDid = useXrpcAgentStore((state) => state.setDid);
    const setServiceUrl = useXrpcAgentStore((state) => state.setServiceUrl);
    const router = useRouter();
    const searchParams = useSearchParams();
    const langParam = searchParams.get('lang');
    const [isLoading, setIsLoading] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

    useEffect(() => {
        setIsMounted(true);

        const checkSession = async () => {
            const result = await useXrpcAgentStore.getState().checkSession();
            setIsAuthenticated(result.authenticated);
        };
        checkSession();
    }, []);

    if (!isMounted) return (
        <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Loading />
        </div>
    );

    const handleStart = async () => {
        setIsLoading(true);

        const apiEndpoint = window.location.host.includes('dev.skyblur.uk') || window.location.host.includes('localhost')
            ? 'devapi.skyblur.uk'
            : 'api.skyblur.uk';

        try {
            let auth = isAuthenticated;
            if (auth === null) {
                const result = await useXrpcAgentStore.getState().checkSession();
                auth = result.authenticated;
            }

            if (auth) {
                // 認証済みならコンソールへ
                router.push('/console');
            } else {
                // 未認証なら localStorage のハンドルを確認
                const handle = localStorage.getItem('oauth.handle');
                if (handle) {
                    // ログイン中通知を表示
                    notifications.show({
                        title: 'Skyblur',
                        message: locale.Home_inAuthProgress || 'Logging in...',
                        loading: true,
                        autoClose: false,
                        withCloseButton: false,
                    });

                    // 数秒待たずに即時リダイレクト
                    window.location.assign(`https://${apiEndpoint}/oauth/login?handle=${encodeURIComponent(handle)}`);
                } else {
                    // ハンドルもなければログインモーダルを表示
                    setIsLoginModalOpened(true);
                }
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

            <Container size={560} p={0}>
                <Text size="sm" className={classes.description}>
                    {locale.Home_WelcomeDescription}
                </Text>
            </Container>

            <div className="flex justify-center mt-10 mb-12">
                <Button
                    size="lg"
                    radius="md"
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
