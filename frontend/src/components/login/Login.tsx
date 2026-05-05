"use client";
import { useLocale } from '@/state/Locale';
import { useXrpcAgentStore } from "@/state/XrpcAgent";
import { AtPassport } from '@atpassport/client/core';
import { AtPassportIcon, AtPassportUI } from '@atpassport/client/ui';
import { getLikelyOAuthHandleTypo, normalizeOAuthHandle } from '@/logic/oauth/handle';
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
    Paper,
    Text,
    Title,
    ComboboxItem,
    Container
} from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { X } from 'lucide-react';
import { useEffect, useState, useRef } from "react";



import { BlueskyIcon } from '../Icons';

export function AuthenticationTitle({ isModal = false }: { isModal?: boolean } = {}) {
    const [handle, setHandle] = useState(() => {
        /* istanbul ignore next -- E2E exercises the client path; this fallback is for SSR safety. */
        if (typeof window !== 'undefined') {
            return localStorage.getItem('oauth.handle') || '';
        }
        return '';
    });
    const [suggestions, setSuggestions] = useState<(ComboboxItem & { avatar?: string })[]>([]);
    const { localeData: locale, locale: lang } = useLocale();
    const [isHandleLoading, setIsHandleLoading] = useState<boolean>(false);
    const [isPassportLoading, setIsPassportLoading] = useState<boolean>(false);
    const isAnyLoading = isHandleLoading || isPassportLoading;

    const publicAgent = useXrpcAgentStore((state) => state.publicAgent);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [warningMessage, setWarningMessage] = useState<string | null>(null);
    const [agreed, setAgreed] = useState<boolean>(() => {
        /* istanbul ignore next -- E2E exercises the client path; this fallback is for SSR safety. */
        if (typeof window !== 'undefined') {
            return localStorage.getItem('login.agreed') === 'true';
        }
        return false;
    });


    /* istanbul ignore next -- Production @passport host selection is covered outside localhost E2E. */
    const isDev = typeof window !== 'undefined' && (window.location.host.includes('dev.skyblur.uk') || window.location.host.includes('localhost'));
    /* istanbul ignore next -- E2E exercises the client path; this fallback is for SSR safety. */
    const apiHost = typeof window !== 'undefined' ? window.location.origin : '';
    const getRedirectUrl = () => {
        const currentPath = window.location.pathname;
        return currentPath === '/' ? `${window.location.origin}/console` : window.location.href;
    };

    // ブラウザバック（bfcache）などで戻った際にローディング状態を確実にリセットする
    useEffect(() => {
        const handlePageShow = (event: PageTransitionEvent) => {
            setIsHandleLoading(false);
            setIsPassportLoading(false);
            notifications.clean();
        };

        setIsHandleLoading(false);
        setIsPassportLoading(false);
        notifications.clean();

        window.addEventListener('pageshow', handlePageShow);
        return () => window.removeEventListener('pageshow', handlePageShow);
    }, []);

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

    const inputRef = useRef<HTMLInputElement>(null);

    // モーダル表示時などに確実にフォーカスを当てる
    useEffect(() => {
        let retryCount = 0;
        const tryFocus = () => {
            if (inputRef.current) {
                inputRef.current.focus();
                // 拡張機能が認識しやすいようにクリックイベントなどもシミュレート
                inputRef.current.click();

                // フォーカスが当たっていない場合は数回リトライする（Chrome対策）
                /* istanbul ignore next -- Browser focus retry is a defensive path not reliably triggerable in E2E. */
                if (document.activeElement !== inputRef.current && retryCount < 10) {
                    retryCount++;
                    setTimeout(tryFocus, 100);
                }
            }
        };
        const timer = setTimeout(tryFocus, 250);
        return () => clearTimeout(timer);
    }, []);

    const handleSignIn = async () => {
        setIsHandleLoading(true)
        /* istanbul ignore next -- The submit button is disabled until a handle exists. */
        if (!handle) {
            notifications.show({
                title: 'Error',
                message: locale.Login_InputHandle,
                color: 'red',
                icon: <X />
            });
            setIsHandleLoading(false)
            return
        }

        if (/\s/.test(handle)) {
            notifications.show({
                title: 'Error',
                message: locale.Login_CannotUseWhiteSpace,
                color: 'red',
                icon: <X />
            });
            setIsHandleLoading(false);
            return;
        }

        if (handle.includes('_')) {
            notifications.show({
                title: 'Error',
                message: locale.Login_CannotUseUnderscore,
                color: 'red',
                icon: <X />
            });
            setIsHandleLoading(false);
            return;
        }

        if (handle.startsWith('@')) {
            notifications.show({
                title: 'Error',
                message: locale.Login_WithAt,
                color: 'red',
                icon: <X />
            });
            setIsHandleLoading(false);
            return;
        }

        if (handle.endsWith('.')) {
            notifications.show({
                title: 'Error',
                message: locale.Login_HandleCannotEndWithDot,
                color: 'red',
                icon: <X />
            });
            setIsHandleLoading(false);
            return;
        }

        if (handle.includes('..')) {
            notifications.show({
                title: 'Error',
                message: locale.Login_HandleCannotHaveConsecutiveDots,
                color: 'red',
                icon: <X />
            });
            setIsHandleLoading(false);
            return;
        }

        if (/[^a-zA-Z0-9.-]/.test(handle)) {
            notifications.show({
                title: 'Error',
                message: locale.Login_InvalidCharacter,
                color: 'red',
                icon: <X />
            });
            setIsHandleLoading(false)
            return
        }

        if (!handle.includes('.')) {
            notifications.show({
                title: 'Error',
                message: locale.Login_NotDomain,
                color: 'red',
                icon: <X />
            });
            setIsHandleLoading(false)
            return
        }

        const likelyTypo = getLikelyOAuthHandleTypo(normalizeOAuthHandle(handle) || '');
        if (likelyTypo) {
            const message = locale.Login_HandleMaybeTypo.replace("{1}", likelyTypo);
            setWarningMessage(message);
            notifications.show({
                title: 'Warning',
                message,
                color: 'yellow',
                icon: <X />
            });
            setIsHandleLoading(false);
            return;
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
            const loginUrl = `${apiHost}/api/oauth/login?handle=${encodeURIComponent(handle)}&redirect_uri=${encodeURIComponent(redirectUrl)}`;
            const response = await fetch(loginUrl, {
                headers: {
                    Accept: 'application/json',
                },
            });
            const data = await response.json().catch(() => null) as { url?: string; error?: string; message?: string } | null;

            if (!response.ok || !data?.url) {
                const message = data?.error === 'invalid_handle'
                    ? locale.Login_InvalidHandle
                    : data?.message || locale.Login_RedirectFailed;
                setErrorMessage(message);
                notifications.clean();
                notifications.show({
                    title: 'Error',
                    message,
                    color: 'red',
                    icon: <X />
                });
                setIsHandleLoading(false);
                return;
            }

            window.location.assign(data.url);

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
            setIsHandleLoading(false);
        }
    }

    const handleAtPassportLogin = async () => {
        const passportHost = isDev ? 'https://preview.atpassport.net' : 'https://atpassport.net';

        const passport = new AtPassport({
            baseUrl: passportHost,
            callbackUrl: `${apiHost}/api/oauth/login`,
            lang: lang
        });

        const { url: atPassportUrl } = passport.generateAuthUrl({
            redirect_uri: getRedirectUrl()
        });

        setIsPassportLoading(true);
        window.location.assign(atPassportUrl);
        // リダイレクトまで待機
        await new Promise(() => { });
    }


    const handleInput = useDebouncedCallback(async (val: string) => {
        /* istanbul ignore next -- Typeahead clear is a defensive debounce path; validation tests cover visible clearing. */
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
            <Box ta="center">
                <Title order={2} mb={0}>
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
                        <Anchor href="/termofuse" target="_blank">
                            {locale.Menu_TermOfUse}
                        </Anchor>
                    </Text>
                }
            />

            <Stack gap="xs">
                <Autocomplete
                    ref={inputRef}
                    label={locale.Login_HandleCaption}
                    placeholder="alice.bsky.social"
                    required
                    id="handle"
                    name="handle"
                    type="text"
                    data-autofocus
                    autoFocus
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
                        const likelyTypo = getLikelyOAuthHandleTypo(normalizeOAuthHandle(value) || '');
                        setWarningMessage(
                            likelyTypo ? locale.Login_HandleMaybeTypo.replace("{1}", likelyTypo) : null
                        );
                    }}
                    error={errorMessage || warningMessage}
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
                    disabled={isAnyLoading || !agreed || !handle}
                    loading={isHandleLoading}
                    loaderProps={{ type: 'dots' }}
                    leftSection={<BlueskyIcon size={20} />}
                >
                    {locale.Login_Login}
                </Button>
            </Stack>

            <Divider label={locale.Login_Or} labelPosition="center" />

            <Box>
                <Button
                    fullWidth
                    size="md"
                    radius="lg"
                    variant="outline"
                    onClick={handleAtPassportLogin}
                    disabled={isAnyLoading || !agreed}
                    loading={isPassportLoading}
                    loaderProps={{ type: 'dots' }}
                    leftSection={<AtPassportIcon size={24} />}
                >
                    {AtPassportUI[lang].title}
                </Button>
                <Text size="xs" c="dimmed" ta="left" mt={8} px={4} lh={1.4}>
                    {AtPassportUI[lang].description}
                </Text>
            </Box>

            <Box ta="center">
                <Anchor
                    href={`${apiHost}/api/oauth/login?prompt=create&redirect_uri=${encodeURIComponent(getRedirectUrl())}`}
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
