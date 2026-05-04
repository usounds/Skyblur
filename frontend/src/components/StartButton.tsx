"use client";
import { useLocale } from "@/state/Locale";
import { useXrpcAgentStore } from "@/state/XrpcAgent";
import { Button, Loader, Text } from '@mantine/core';
import { Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from "react";

const SESSION_CHECK_RETRY_SECONDS = 30;

export function StartButton() {
    const { localeData: locale } = useLocale();
    const setIsLoginModalOpened = useXrpcAgentStore((state) => state.setIsLoginModalOpened);
    const router = useRouter();
    const did = useXrpcAgentStore((state) => state.did);
    const isSessionChecked = useXrpcAgentStore((state) => state.isSessionChecked);
    const [isLoading, setIsLoading] = useState(false);
    const [isSessionRetryReady, setIsSessionRetryReady] = useState(false);
    const [isSessionRetryWaiting, setIsSessionRetryWaiting] = useState(false);
    const [sessionCheckSecondsLeft, setSessionCheckSecondsLeft] = useState(SESSION_CHECK_RETRY_SECONDS);
    const sessionCheckAttemptRef = useRef(0);
    const initialSessionCheckStartedRef = useRef(false);
    const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearSessionCheckTimers = useCallback(() => {
        if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
        }
        if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
        }
    }, []);

    const runSessionCheck = useCallback(async ({ force = false } = {}) => {
        const attemptId = sessionCheckAttemptRef.current + 1;
        sessionCheckAttemptRef.current = attemptId;
        clearSessionCheckTimers();
        setIsSessionRetryReady(false);
        setIsSessionRetryWaiting(false);
        setSessionCheckSecondsLeft(SESSION_CHECK_RETRY_SECONDS);

        if (force) {
            useXrpcAgentStore.getState().setIsSessionChecked(false);
        }

        countdownTimerRef.current = setInterval(() => {
            setSessionCheckSecondsLeft((secondsLeft) => Math.max(0, secondsLeft - 1));
        }, 1000);

        retryTimerRef.current = setTimeout(() => {
            if (sessionCheckAttemptRef.current !== attemptId) return;
            setIsSessionRetryWaiting(false);
            setIsSessionRetryReady(true);
            setSessionCheckSecondsLeft(0);
        }, SESSION_CHECK_RETRY_SECONDS * 1000);

        try {
            const result = await useXrpcAgentStore.getState().checkSession();
            if (sessionCheckAttemptRef.current !== attemptId) return result;

            if (!result.timedOut) {
                clearSessionCheckTimers();
                setIsSessionRetryWaiting(false);
                setIsSessionRetryReady(false);
            } else {
                setIsSessionRetryWaiting(true);
            }
            return result;
        } catch (err) {
            if (sessionCheckAttemptRef.current === attemptId) {
                clearSessionCheckTimers();
                setIsSessionRetryWaiting(false);
                setIsSessionRetryReady(true);
            }
            throw err;
        }
    }, [clearSessionCheckTimers]);

    useEffect(() => {
        if (initialSessionCheckStartedRef.current) return;
        initialSessionCheckStartedRef.current = true;
        if (useXrpcAgentStore.getState().isSessionChecked) return;
        runSessionCheck();
        return () => {
            sessionCheckAttemptRef.current += 1;
            clearSessionCheckTimers();
        };
    }, [clearSessionCheckTimers, runSessionCheck]);

    const handleStart = async () => {
        setIsLoading(true);

        try {
            // セッションチェックが終わっていない場合はまずチェック
            const currentSession = useXrpcAgentStore.getState();
            let currentDid = currentSession.did;
            if (!currentSession.isSessionChecked) {
                const result = await runSessionCheck();
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

    const handleRetrySessionCheck = async () => {
        setIsLoading(true);

        try {
            const result = await runSessionCheck({ force: true });

            if (result?.did) {
                router.push('/console');
                return;
            }

            if (result && !result.timedOut) {
                setIsLoginModalOpened(true);
            }
        } catch (err) {
            console.error("Failed to retry session check", err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex justify-center items-center mt-10 mb-12" style={{ minHeight: '64px' }}>
            {isSessionRetryReady ? (
                <Button
                    variant="outline" size="md" radius="lg"
                    onClick={handleRetrySessionCheck}
                    loading={isLoading}
                    leftSection={<Sparkles size={24} />}
                    className="px-10 h-16 text-lg"
                >
                    {locale.Landing_StartRetryButton}
                </Button>
            ) : !isSessionChecked || isSessionRetryWaiting ? (
                <div className="flex flex-col items-center justify-center gap-2 h-16">
                    <Loader color="blue" type="dots" />
                    <Text size="sm" c="dimmed">
                        {locale.Home_CheckingSessionWithTimer.replace('{1}', String(sessionCheckSecondsLeft))}
                    </Text>
                </div>
            ) : (
                <Button
                    variant="filled" size="md" radius="lg"
                    onClick={handleStart}
                    loading={isLoading}
                    leftSection={<Sparkles size={24} />}
                    className="px-10 h-16 text-lg"
                >
                    {locale.Landing_StartButton}
                </Button>
            )}
        </div>
    );
}
