"use client";
import {
    Button,
    Container,
    Paper,
    Autocomplete,
    Title
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useState } from "react";
import { X } from 'lucide-react';
import LanguageSelect from "../LanguageSelect";
import { useLocale } from '@/state/Locale';
import { useXrpcAgentStore } from "@/state/XrpcAgent";

import { BlueskyIcon } from '../Icons';

export function AuthenticationTitle({ isModal = false }: { isModal?: boolean } = {}) {
    const [handle, setHandle] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('oauth.handle') || '';
        }
        return '';
    });
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const { localeData: locale } = useLocale();
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const publicAgent = useXrpcAgentStore((state) => state.publicAgent);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // loginError パラメータがある場合、エラーメッセージを表示
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('loginError')) {
            setErrorMessage(locale.Login_InvalidHandle || '無効なハンドルです');
        }
    }, [locale.Login_InvalidHandle]);

    const handleSignIn = async () => {
        setIsLoading(true)
        if (!handle) {
            notifications.show({
                title: 'Error',
                message: locale.Login_InputHandle,
                color: 'red',
                icon: <X />
            });
            setIsLoading(false)
            return
        }

        if (/\s/.test(handle)) {
            notifications.show({
                title: 'Error',
                message: locale.Login_CannotUseWhiteSpace,
                color: 'red',
                icon: <X />
            });
            setIsLoading(false);
            return;
        }

        if (!handle.includes('.')) {
            notifications.show({
                title: 'Error',
                message: locale.Login_NotDomain,
                color: 'red',
                icon: <X />
            });
            setIsLoading(false)
            return
        }
        if (handle.startsWith('@')) {
            notifications.show({
                title: 'Error',
                message: locale.Login_WithAt,
                color: 'red',
                icon: <X />
            });
            setIsLoading(false)
            return
        }

        notifications.show({
            id: 'login-process',
            title: locale.Login_Login,
            message: locale.Login_DidResolve,
            loading: true,
            autoClose: false
        });

        try {
            // バックエンドのログインAPIへリダイレクト
            window.localStorage.setItem('oauth.handle', handle);

            let apiEndpoint = 'api.skyblur.uk';
            if (window.location.host.includes('dev.skyblur.uk') || window.location.host.includes('localhost')) {
                apiEndpoint = 'devapi.skyblur.uk';
            }


            const currentUrl = window.location.href;
            const loginUrl = `https://${apiEndpoint}/oauth/login?handle=${encodeURIComponent(handle)}&redirect_uri=${encodeURIComponent(currentUrl)}`;
            window.location.assign(loginUrl);

            // リダイレクトまで待機
            await new Promise(() => { });
        } catch (e) {
            console.error('Login error:', e);
            notifications.clean();
            notifications.show({
                title: 'Error',
                message: locale.Login_InvalidHandle,
                color: 'red',
                icon: <X />
            });
            setIsLoading(false);
        }
    }


    const handleInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const val = event.currentTarget.value;
        if (!val) {
            setSuggestions([]);
            return;
        }

        try {
            const res = await publicAgent.get("app.bsky.actor.searchActorsTypeahead", {
                params: {
                    q: val,
                    limit: 5,
                },
            });

            if (res.ok) {
                setSuggestions(res.data.actors.map((a) => a.handle));
            }
        } catch (err) {
            console.error("searchActorsTypeahead error", err);
        }
    };


    const loginForm = (
        <>
            {!isModal && <Title order={2} size="h3" mb="md" ta="center">{locale.Login_Login}</Title>}
            <Autocomplete
                label={locale.Login_HandleCaption}
                placeholder="alice.bsky.social"
                required
                radius="md"
                autoCapitalize={"none"}
                autoCorrect={"off"}
                autoComplete={"off"}
                spellCheck={false}
                value={handle}
                data={suggestions}
                onInput={handleInput}
                onChange={(value) => {
                    setHandle(value);
                    setSuggestions([]);
                    setErrorMessage(null); // 入力時にエラーをクリア
                }}
                error={errorMessage}
                styles={{
                    input: {
                        fontSize: 16,
                    },
                }
                }
            />
            <LanguageSelect />
            <Button fullWidth mt="xl" radius="md" onClick={handleSignIn} loading={isLoading} loaderProps={{ type: 'dots' }} leftSection={<BlueskyIcon size={20} />}>
                {locale.Login_Login}
            </Button>
        </>
    );

    if (isModal) {
        return loginForm;
    }

    return (
        <Container size={320} >
            <Paper withBorder shadow="sm" p={22} mt={30} radius="md">
                {loginForm}
            </Paper>
        </Container>
    );
}