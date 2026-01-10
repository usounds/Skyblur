"use client";
import { IdentityResolver } from '@/logic/IdentityResolver';
import { useLocaleStore } from "@/state/Locale";
import { getClientMetadata, scopeList } from '@/types/ClientMetadataContext';
import { configureOAuth, createAuthorizationUrl } from '@atcute/oauth-browser-client';
import {
    Button,
    Container,
    Paper,
    Autocomplete,
    Title
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from "react";
import { X } from 'lucide-react';
import LanguageSelect from "../LanguageSelect";
import { useXrpcAgentStore } from "@/state/XrpcAgent";
import { ActorIdentifier } from '@atcute/lexicons/syntax';

import { BlueskyIcon } from '../Icons';

export function AuthenticationTitle({ isModal = false }: { isModal?: boolean } = {}) {
    const [handle, setHandle] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('oauth.handle') || '';
        }
        return '';
    });
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const locale = useLocaleStore((state) => state.localeData);
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const publicAgent = useXrpcAgentStore((state) => state.publicAgent);

    function sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

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

        const serverMetadata = getClientMetadata();

        console.log(serverMetadata)

        if (serverMetadata === undefined) {
            return
        }

        configureOAuth({
            metadata: {
                client_id: serverMetadata.client_id || '',
                redirect_uri: serverMetadata.redirect_uris[0] || '',
            },
            identityResolver: IdentityResolver,
        });
        notifications.show({
            id: 'login-process',
            title: locale.Login_Login,
            message: locale.Login_DidResolve,
            loading: true,
            autoClose: false
        });

        try {
            // Resolve identity to get PDS host for display message
            const resolved = await IdentityResolver.resolve(handle as ActorIdentifier);

            let host: string;
            try {
                const pdsUrl = new URL(resolved.pds);
                if (pdsUrl.host.endsWith('.bsky.network')) {
                    host = 'bsky.social';
                } else {
                    host = pdsUrl.host;
                }
            } catch {
                host = resolved.pds;
            }

            const message = locale.Login_Redirect.replace("{1}", host);
            window.localStorage.setItem('oauth.handle', handle);
            window.localStorage.setItem('oauth.callbackUrl', window.location.href);

            notifications.update({
                id: 'login-process',
                title: locale.Login_Login,
                message: message,
                loading: true,
                autoClose: false
            });

            const authUrl = await createAuthorizationUrl({
                target: {
                    type: 'account',
                    identifier: handle as ActorIdentifier,
                },
                scope: scopeList,
            });

            // recommended to wait for the browser to persist local storage before proceeding
            await sleep(200);

            // redirect the user to sign in and authorize the app
            window.location.assign(authUrl);

            // if this is on an async function, ideally the function should never ever resolve.
            // the only way it should resolve at this point is if the user aborted the authorization
            // by returning back to this page (thanks to back-forward page caching)
            await new Promise((_resolve, reject) => {
                const listener = () => {
                    reject(new Error(`user aborted the login request`));
                };

                window.addEventListener('pageshow', listener, { once: true });

            })
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
            return;
        }
    }


    const handleInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const val = event.currentTarget.value;

        console.log(val)

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
                // actor.handle を候補として表示
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
                }}
                styles={{
                    input: {
                        fontSize: 16,  // 16pxに設定
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