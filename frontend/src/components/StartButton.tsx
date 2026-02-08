"use client";
import { useLocale } from "@/state/Locale";
import { useXrpcAgentStore } from "@/state/XrpcAgent";
import { Button, Loader, Text } from '@mantine/core';
import { Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from "react";

export function StartButton() {
    const { localeData: locale } = useLocale();
    const setIsLoginModalOpened = useXrpcAgentStore((state) => state.setIsLoginModalOpened);
    const router = useRouter();
    const did = useXrpcAgentStore((state) => state.did);
    const isSessionChecked = useXrpcAgentStore((state) => state.isSessionChecked);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const checkSession = async () => {
            await useXrpcAgentStore.getState().checkSession();
        };
        checkSession();
    }, []);

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

    return (
        <div className="flex justify-center items-center mt-10 mb-12" style={{ minHeight: '64px' }}>
            {!isSessionChecked ? (
                <div className="flex flex-col items-center justify-center gap-2 h-16">
                    <Loader color="blue" type="dots" />
                    <Text size="sm" c="dimmed">{locale.Home_CheckingSession}</Text>
                </div>
            ) : (
                <Button
                    variant="filled" size="md" radius="lg"
                    onClick={handleStart}
                    loading={isLoading}
                    leftSection={<Sparkles size={24} />}
                    className="px-10 h-16 text-lg"
                >
                    {locale.Landing_StartButton || 'Start'}
                </Button>
            )}
        </div>
    );
}
