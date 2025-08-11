"use client";
import { useLocaleStore } from "@/state/Locale";
import { getClientMetadata } from '@/types/ClientMetadataContext';
import { configureOAuth, createAuthorizationUrl, resolveFromIdentity } from '@atcute/oauth-browser-client';
import {
    Button,
    Container,
    Paper,
    TextInput
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from "react";
import { HiX } from "react-icons/hi";
import LanguageSelect from "../LanguageSelect";

export function AuthenticationTitle() {
    const [handle, setHandle] = useState("");
    const locale = useLocaleStore((state) => state.localeData);
    const [isLoading, setIsLoading] = useState<boolean>(false)

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
                icon: <HiX />
            });
            setIsLoading(false)
            return
        }

        if (!handle.includes('.')) {
            notifications.show({
                title: 'Error',
                message: locale.Login_NotDomain,
                color: 'red',
                icon: <HiX />
            });
            setIsLoading(false)
            return
        }
        if (handle.startsWith('@')) {
            notifications.show({
                title: 'Error',
                message: locale.Login_WithAt,
                color: 'red',
                icon: <HiX />
            });
            setIsLoading(false)
            return

        }

        const serverMetadata = getClientMetadata();

        if (serverMetadata === undefined) {
            return
        }

        configureOAuth({
            metadata: {
                client_id: serverMetadata.client_id || '',
                redirect_uri: serverMetadata.redirect_uris[0] || '',
            },
        });
        let identity, metadata;
        notifications.show({
            id: 'login-process',
            title: locale.Login_Login,
            message: locale.Login_DidResolve,
            loading: true,
            autoClose: false
        });
        try {
            const resolved = await resolveFromIdentity(handle);
            identity = resolved.identity;
            metadata = resolved.metadata;

        } catch (e) {
            console.error('resolveFromIdentity error:', e);
            notifications.update({
                id: 'login-process',
                title: 'Error',
                message: locale.Login_InvalidHandle,
                color: 'red',
                loading: false,
                autoClose: true,
                icon: <HiX />
            });
            setIsLoading(false);
            return;
        }

        if (!identity) {
            notifications.update({
                id: 'login-process',
                title: 'Error',
                message: locale.Login_InvalidHandle,
                color: 'red',
                loading: false,
                autoClose: true
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
                scope: 'atproto transition:generic',
            });
        } catch (e) {
            console.error('createAuthorizationUrl error:', e);
            notifications.clean()
            notifications.show({
                title: 'Error',
                message: 'Failed to create authorization URL',
                color: 'red',
                icon: <HiX />
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


    return (
        <Container size={320} >
            <Paper withBorder shadow="sm" p={22} mt={30} radius="md">
                <TextInput
                    label="Handle"
                    placeholder="alice.bsky.social"
                    required
                    radius="md"
                    value={handle}
                    onChange={(event) => setHandle(event.target.value)}
                    styles={{
                        input: {
                            fontSize: 16,  // 16pxに設定
                        },
                    }}
                />
                <LanguageSelect />
                <Button fullWidth mt="xl" radius="md" onClick={handleSignIn} loading={isLoading} loaderProps={{ type: 'dots' }}>
                    <svg
                        className="h-5 w-5 mr-2"
                        width="24"
                        height="24"
                        viewBox="0 0 1452 1452"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d="M725.669,684.169c85.954,-174.908 196.522,-329.297 331.704,-463.171c45.917,-43.253 98.131,-74.732 156.638,-94.443c80.779,-23.002 127.157,10.154 139.131,99.467c-2.122,144.025 -12.566,287.365 -31.327,430.015c-29.111,113.446 -96.987,180.762 -203.629,201.947c-36.024,5.837 -72.266,8.516 -108.726,8.038c49.745,11.389 95.815,32.154 138.21,62.292c77.217,64.765 90.425,142.799 39.62,234.097c-37.567,57.717 -83.945,104.938 -139.131,141.664c-82.806,48.116 -154.983,33.716 -216.529,-43.202c-28.935,-38.951 -52.278,-81.818 -70.026,-128.603c-12.177,-34.148 -24.156,-68.309 -35.935,-102.481c-11.779,34.172 -23.757,68.333 -35.934,102.481c-17.748,46.785 -41.091,89.652 -70.027,128.603c-61.545,76.918 -133.722,91.318 -216.529,43.202c-55.186,-36.726 -101.564,-83.947 -139.131,-141.664c-50.804,-91.298 -37.597,-169.332 39.62,-234.097c42.396,-30.138 88.466,-50.903 138.21,-62.292c-36.46,0.478 -72.702,-2.201 -108.725,-8.038c-106.643,-21.185 -174.519,-88.501 -203.629,-201.947c-18.762,-142.65 -29.205,-285.99 -31.328,-430.015c11.975,-89.313 58.352,-122.469 139.132,-99.467c58.507,19.711 110.72,51.19 156.637,94.443c135.183,133.874 245.751,288.263 331.704,463.171Z"
                            fill="currentColor"
                        />
                    </svg>
                    {locale.Login_Login}
                </Button>

            </Paper>

        </Container>
    );
}