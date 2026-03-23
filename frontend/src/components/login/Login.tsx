"use client";
import { useLocale } from '@/state/Locale';
import { useXrpcAgentStore } from "@/state/XrpcAgent";
import { AtPassport } from '@atpassport/client/core';
import { AtPassportIcon, AtPassportUI } from '@atpassport/client/ui';
import {
    Anchor,
    Autocomplete,
    Avatar,
    Button,
    Divider,
    Group,
    Checkbox,
    Stack,
    Box,
    UnstyledButton,
    Collapse,
    Center,
    Paper,
    Text,
    Title,
    ComboboxItem,
    Container
} from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { X } from 'lucide-react';
import { useEffect, useState } from "react";



import { BlueskyIcon } from '../Icons';

export function AuthenticationTitle({ isModal = false }: { isModal?: boolean } = {}) {
    const [handle, setHandle] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('oauth.handle') || '';
        }
        return '';
    });
    const [suggestions, setSuggestions] = useState<(ComboboxItem & { avatar?: string })[]>([]);
    const { localeData: locale, locale: lang } = useLocale();
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const publicAgent = useXrpcAgentStore((state) => state.publicAgent);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [agreed, setAgreed] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('login.agreed') === 'true';
        }
        return false;
    });
    const [showHandleLogin, setShowHandleLogin] = useState<boolean>(false);

    const isDev = typeof window !== 'undefined' && (window.location.host.includes('dev.skyblur.uk') || window.location.host.includes('localhost'));
    const apiHost = isDev ? 'devapi.skyblur.uk' : 'api.skyblur.uk';
    const getRedirectUrl = () => {
        const currentPath = window.location.pathname;
        return currentPath === '/' ? `${window.location.origin}/console` : window.location.href;
    };

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

    // 同意状態を localStorage に保存
    useEffect(() => {
        localStorage.setItem('login.agreed', agreed.toString());
    }, [agreed]);

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

            const redirectUrl = getRedirectUrl();
            const loginUrl = `https://${apiHost}/oauth/login?handle=${encodeURIComponent(handle)}&redirect_uri=${encodeURIComponent(redirectUrl)}`;
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

    const handleAtPassportLogin = async () => {
        if (!agreed) {
            notifications.show({
                title: 'Error',
                message: locale.Login_AgreeToTerms,
                color: 'red',
            });
            return;
        }
        const passportHost = isDev ? 'https://dev.atpassport.net' : 'https://atpassport.net';

        const passport = new AtPassport({
            baseUrl: passportHost,
            callbackUrl: `https://${apiHost}/oauth/login`,
            lang: lang
        });

        const { url: atPassportUrl } = passport.generateAuthUrl({
            redirect_uri: getRedirectUrl()
        });

        setIsLoading(true);
        window.location.assign(atPassportUrl);
        // リダイレクトまで待機
        await new Promise(() => { });
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
        <Stack gap="md">
            <Box ta="center" >
                <Title order={2} mb={0} >
                    Skyblur
                </Title>
                <Text size="sm" c="dimmed" mt={4}>
                    {locale.Login_SubTitle}
                </Text>
            </Box>

            <Checkbox
                checked={agreed}
                onChange={(event) => setAgreed(event.currentTarget.checked)}
                label={
                    <Text size="sm">
                        {locale.Login_AgreeToTerms}{' '}
                        <Anchor href="/termofuse" target="_blank" >
                            {locale.Menu_TermOfUse}
                        </Anchor>
                    </Text>
                }
            />

            {!showHandleLogin ? (
                <Stack gap="md">
                    <Box>
                        <Button
                            fullWidth
                            size="md"
                            radius="lg"
                            onClick={handleAtPassportLogin}
                            disabled={isLoading || !agreed}
                            loading={isLoading}
                            loaderProps={{ type: 'dots' }}
                            leftSection={<AtPassportIcon size={24} />}
                            color="blue"
                        >
                            {AtPassportUI[lang]?.title}
                        </Button>
                        <Text size="xs" c="dimmed" ta="left" mt={8} px={4} lh={1.4}>
                            {AtPassportUI[lang]?.description}
                        </Text>
                    </Box>

                    <Divider label={locale.Login_Or} labelPosition="center" />

                    <Box>
                        <Button
                            variant="outline"
                            fullWidth
                            size="md"
                            radius="lg"
                            onClick={() => setShowHandleLogin(true)}
                            disabled={!agreed}
                        >
                            {locale.Login_LoginWithHandle}
                        </Button>
                    </Box>
                </Stack>
            ) : (
                <Stack gap="md">
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
                            setErrorMessage(null);
                        }}
                        error={errorMessage}
                        styles={{
                            input: {
                                fontSize: 16,
                            },
                        }}
                    />

                    <Button
                        fullWidth
                        mt="md"
                        radius="lg"
                        size="md"
                        onClick={handleSignIn}
                        disabled={isLoading || !agreed}
                        loading={isLoading}
                        loaderProps={{ type: 'dots' }}
                        leftSection={<BlueskyIcon size={20} />}
                    >
                        {locale.Login_Login}
                    </Button>

                    <Center mt="xs">
                        <UnstyledButton onClick={() => setShowHandleLogin(false)}>
                            <Text size="xs" c="dimmed" td="underline">
                                {locale.Menu_Back}
                            </Text>
                        </UnstyledButton>
                    </Center>
                </Stack>
            )}

            <Box ta="center">


                <Anchor
                    href={`https://${apiHost}/oauth/login?prompt=create&redirect_uri=${encodeURIComponent(getRedirectUrl())}`}
                    size="sm"
                    mt="xs"
                    display="block"
                >
                    {locale.Login_CreateAccount}
                </Anchor>
            </Box>
        </Stack>
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