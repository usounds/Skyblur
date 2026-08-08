"use client";

import en from "@/locales/en";
import ja from "@/locales/ja";
import { useLocaleStore } from "@/state/Locale";
import type { Locales } from "@/state/Locale";
import { useXrpcAgentStore } from "@/state/XrpcAgent";
import { Button, Group, Loader, Modal, Text } from '@mantine/core';
import { Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from "react";
import classes from './StartButton.module.css';

const RESTORE_MODAL_DELAY_MS = 180;

export function StartButton({ initialLocale }: { initialLocale: Locales }) {
    const storeLocale = useLocaleStore((state) => state.locale);
    const initLocale = useLocaleStore((state) => state.initLocale);
    const setIsLoginModalOpened = useXrpcAgentStore((state) => state.setIsLoginModalOpened);
    const router = useRouter();
    const [isLocaleHydrated, setIsLocaleHydrated] = useState(false);
    const [isStartPending, setIsStartPending] = useState(false);
    const [isRestoreModalOpened, setIsRestoreModalOpened] = useState(false);
    const initialSessionCheckStartedRef = useRef(false);
    const startAttemptRef = useRef(0);
    const restoreModalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const activeLocale = isLocaleHydrated ? storeLocale : initialLocale;
    const locale = activeLocale === 'en' ? en : ja;

    const clearRestoreModalTimer = () => {
        if (!restoreModalTimerRef.current) return;
        clearTimeout(restoreModalTimerRef.current);
        restoreModalTimerRef.current = null;
    };

    useEffect(() => {
        initLocale(initialLocale);
        setIsLocaleHydrated(true);
    }, [initLocale, initialLocale]);

    useEffect(() => {
        if (initialSessionCheckStartedRef.current) return;
        initialSessionCheckStartedRef.current = true;
        if (useXrpcAgentStore.getState().isSessionChecked) return;

        void useXrpcAgentStore.getState().checkSession();
    }, []);

    useEffect(() => () => {
        startAttemptRef.current += 1;
        if (restoreModalTimerRef.current) {
            clearTimeout(restoreModalTimerRef.current);
            restoreModalTimerRef.current = null;
        }
    }, []);

    const handleStart = async () => {
        const currentSession = useXrpcAgentStore.getState();

        if (currentSession.isSessionChecked) {
            if (currentSession.did) {
                router.push('/console');
            } else {
                setIsLoginModalOpened(true);
            }
            return;
        }

        const attemptId = startAttemptRef.current + 1;
        startAttemptRef.current = attemptId;
        setIsStartPending(true);
        clearRestoreModalTimer();
        restoreModalTimerRef.current = setTimeout(() => {
            if (startAttemptRef.current === attemptId) {
                setIsRestoreModalOpened(true);
            }
        }, RESTORE_MODAL_DELAY_MS);

        try {
            const result = await useXrpcAgentStore.getState().checkSession();
            if (startAttemptRef.current !== attemptId) return;

            clearRestoreModalTimer();
            setIsRestoreModalOpened(false);

            if (result.did) {
                router.push('/console');
            } else if (!result.timedOut) {
                setIsLoginModalOpened(true);
            }
        } catch (err) {
            if (startAttemptRef.current !== attemptId) return;
            console.error("Failed to check session", err);
            clearRestoreModalTimer();
            setIsRestoreModalOpened(false);
            setIsLoginModalOpened(true);
        } finally {
            if (startAttemptRef.current === attemptId) {
                setIsStartPending(false);
            }
        }
    };

    const handleRestoreModalClose = () => {
        startAttemptRef.current += 1;
        clearRestoreModalTimer();
        setIsRestoreModalOpened(false);
        setIsStartPending(false);
    };

    return (
        <div className="flex justify-center items-center" style={{ minHeight: '64px' }}>
            <Button
                variant="filled" size="md" radius="lg"
                onClick={handleStart}
                disabled={isStartPending}
                leftSection={<Sparkles size={24} />}
                className="px-10 h-16 text-lg min-w-[180px]"
                color="blue.8"
            >
                {locale.Landing_StartButton}
            </Button>

            <Modal.Root
                opened={isRestoreModalOpened}
                onClose={handleRestoreModalClose}
                centered
                radius="xl"
                size={320}
                transitionProps={{ transition: 'fade-up', duration: 180 }}
            >
                <Modal.Overlay backgroundOpacity={0.24} blur={3} />
                <Modal.Content
                    aria-label={locale.Home_CheckingSession}
                    className={classes.restoreModal}
                >
                    <Modal.Body className={classes.restoreModalBody}>
                        <Group gap="md" wrap="nowrap">
                            <div className={classes.restoreIndicator} aria-hidden="true">
                                <Loader size={20} color="blue.6" />
                            </div>
                            <Text
                                className={classes.restoreMessage}
                                role="status"
                                aria-live="polite"
                                aria-atomic="true"
                            >
                                {locale.Home_CheckingSession}
                            </Text>
                        </Group>
                    </Modal.Body>
                </Modal.Content>
            </Modal.Root>
        </div>
    );
}
