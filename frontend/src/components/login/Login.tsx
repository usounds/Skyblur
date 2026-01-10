"use client";
import { resolveHandleViaDoH, resolveHandleViaHttp } from '@/logic/HandleDidredolver';
import { useLocaleStore } from "@/state/Locale";
import { getClientMetadata, scopeList } from '@/types/ClientMetadataContext';
import type { Did } from '@atcute/lexicons';
import { configureOAuth, createAuthorizationUrl, IdentityMetadata, AuthorizationServerMetadata, resolveFromIdentity } from '@atcute/oauth-browser-client';
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
        });
        let identity: IdentityMetadata, metadata: AuthorizationServerMetadata, did: Did | null = null;
        notifications.show({
            id: 'login-process',
            title: locale.Login_Login,
            message: locale.Login_DidResolve,
            loading: true,
            autoClose: false
        });

        try {

            try {
                //　HTTP 解決
                did = await resolveHandleViaHttp(handle);
            } catch (e) {
                console.warn('HTTP resolve failed, trying DoH:', e);
                try {
                    // DoH 解決
                    did = await resolveHandleViaDoH(handle);
                } catch (e2) {
                    console.error('DoH resolve failed:', e2);

                    // app.bsky.actor.getProfileからDID解決
                    const userProfileResponse = await publicAgent.get('app.bsky.actor.getProfile', {
                        params: { actor: handle as ActorIdentifier },
                    })

                    if (!userProfileResponse.ok) {
                        // 両方ダメなら通知出して終了
                        notifications.update({
                            id: 'login-process',
                            title: 'Error',
                            message: locale.Login_InvalidHandle,
                            color: 'red',
                            loading: false,
                            autoClose: true,
                            icon: <X />
                        });
                        setIsLoading(false);
                        return;
                    }

                    did = userProfileResponse.data.did

                }
            }

            // DIDからDid DocumentとPDSのOAuth Metadataを取得
            const resolved = await resolveFromIdentity(did);
            identity = resolved.identity
            metadata = resolved.metadata

            // rawはhandleに上書き
            identity.raw = handle

        } catch (e) {
            // 想定外の例外キャッチ
            console.error('resolveFromIdentity unexpected error:', e);
            notifications.update({
                id: 'login-process',
                title: 'Error',
                message: 'Unexpected Error:' + e,
                color: 'red',
                loading: false,
                autoClose: true,
                icon: <X />
            });
            setIsLoading(false);
            return;
        }

        let host;
        if (identity.pds.host.endsWith('.bsky.network')) {
            host = 'bsky.social'
        } else {
            host = identity.pds.host
        }

        const message = locale.Login_Redirect.replace("{1}", host)
        window.localStorage.setItem('oauth.handle', handle)
        window.localStorage.setItem('oauth.callbackUrl', window.location.href)

        notifications.update({
            id: 'login-process',
            title: locale.Login_Login,
            message: message,
            loading: true,
            autoClose: false
        });

        let authUrl;
        try {
            authUrl = await createAuthorizationUrl({
                metadata: metadata,
                identity: identity,
                scope: scopeList
            });
        } catch (e) {
            console.error('createAuthorizationUrl error:', e);
            notifications.clean()
            notifications.show({
                title: 'Error',
                message: 'Failed to create authorization URL',
                color: 'red',
                icon: <X />
            });
            setIsLoading(false);
            return;
        }

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