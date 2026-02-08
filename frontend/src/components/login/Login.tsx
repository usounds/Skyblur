"use client";
import { useLocale } from '@/state/Locale';
import { useXrpcAgentStore } from "@/state/XrpcAgent";
import {
    Anchor,
    Autocomplete,
    Avatar,
    Button,
    Container,
    Group,
    Paper,
    Text,
    Title,
    ComboboxItem
} from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { X } from 'lucide-react';
import { useEffect, useState } from "react";
import LanguageSelect from "../LanguageSelect";

import { BlueskyIcon } from '../Icons';

export function AuthenticationTitle({ isModal = false }: { isModal?: boolean } = {}) {
    const [handle, setHandle] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('oauth.handle') || '';
        }
        return '';
    });
    const [suggestions, setSuggestions] = useState<(ComboboxItem & { avatar?: string })[]>([]);
    const { localeData: locale } = useLocale();
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const publicAgent = useXrpcAgentStore((state) => state.publicAgent);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // loginError パラメータがある場合、エラーメッセージを表示
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const error = params.get('loginError');
        if (error === 'invalid_handle') {
            setErrorMessage(locale.Login_InvalidHandle || '無効なハンドルです');
        } else {
            setErrorMessage(null);
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

        if (handle.includes('_')) {
            notifications.show({
                title: 'Error',
                message: locale.Login_CannotUseUnderscore,
                color: 'red',
                icon: <X />
            });
            setIsLoading(false);
            return;
        }

        if (/[^a-zA-Z0-9.-]/.test(handle)) {
            notifications.show({
                title: 'Error',
                message: locale.Login_InvalidCharacter,
                color: 'red',
                icon: <X />
            });
            setIsLoading(false);
            return;
        }

        if (handle.endsWith('.')) {
            notifications.show({
                title: 'Error',
                message: locale.Login_HandleCannotEndWithDot,
                color: 'red',
                icon: <X />
            });
            setIsLoading(false);
            return;
        }

        if (handle.includes('..')) {
            notifications.show({
                title: 'Error',
                message: locale.Login_HandleCannotHaveConsecutiveDots,
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


            // ホームページからログインした場合は /console へリダイレクト
            const currentPath = window.location.pathname;
            const redirectUrl = currentPath === '/' ? `${window.location.origin}/console` : window.location.href;
            const loginUrl = `https://${apiEndpoint}/oauth/login?handle=${encodeURIComponent(handle)}&redirect_uri=${encodeURIComponent(redirectUrl)}`;
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


    const handleInput = useDebouncedCallback(async (val: string) => {
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
                setSuggestions(res.data.actors.map((a) => ({
                    value: a.handle,
                    label: a.handle,
                    avatar: a.avatar
                })));
            }
        } catch (err) {
            // console.error("searchActorsTypeahead error", err);
        }
    }, 300);


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
                renderOption={({ option }: { option: any }) => (
                    <Group gap="sm">
                        <Avatar src={option.avatar} size={24} radius="xl" />
                        <Text size="sm">{option.value}</Text>
                    </Group>
                )}
                onInput={(event) => handleInput(event.currentTarget.value)}
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
            <Anchor
                href={`https://${typeof window !== 'undefined' && (window.location.host.includes('dev.skyblur.uk') || window.location.host.includes('localhost')) ? 'devapi.skyblur.uk' : 'api.skyblur.uk'}/oauth/login?redirect_uri=${typeof window !== 'undefined' ? encodeURIComponent(window.location.pathname === '/' ? `${window.location.origin}/console` : window.location.href) : ''}`}
                size="sm"
                mt="md"
                ta="center"
                display="block"
            >
                {locale.Login_CreateAccount}
            </Anchor>
            <Button fullWidth mt="md" radius="md" onClick={handleSignIn} loading={isLoading} loaderProps={{ type: 'dots' }} leftSection={<BlueskyIcon size={20} />}>
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