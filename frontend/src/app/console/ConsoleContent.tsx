"use client";
import { CreatePostForm } from "@/components/CreatePost";
import { AuthenticationTitle } from "@/components/login/Login";
import PageLoading from "@/components/PageLoading";
import { PostList } from "@/components/PostList";
import { useLocale } from "@/state/Locale";
import { useModeStore } from "@/state/Mode";
import { useXrpcAgentStore } from "@/state/XrpcAgent";
import { PostListItem, VISIBILITY_FOLLOWERS, VISIBILITY_FOLLOWING, VISIBILITY_MUTUAL } from "@/types/types";
import { Button } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { notifications } from '@mantine/notifications'; // Added
import { ResourceUri } from '@atcute/lexicons/syntax'; // Added
import { Pencil, X } from 'lucide-react';
import { useEffect, useState } from "react";

export function ConsoleContent() {
    const [prevBlur, setPrevBlur] = useState<PostListItem>()
    const did = useXrpcAgentStore((state) => state.did);
    const { localeData: locale } = useLocale();
    const userProf = useXrpcAgentStore((state) => state.userProf);
    const mode = useModeStore((state) => state.mode);
    const setMode = useModeStore((state) => state.setMode);
    const serviceUrl = useXrpcAgentStore((state) => state.serviceUrl);

    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

    const handleEdit = async (input: PostListItem) => {
        // Only fetch if not already fetched/decrypted
        if (input.isDecrypt) {
            setPrevBlur(input);
            setMode("create")
            return;
        }
        // Restricted content pre-fetch
        if ([VISIBILITY_FOLLOWERS, VISIBILITY_FOLLOWING, VISIBILITY_MUTUAL].includes(input.blur.visibility || '')) {
            notifications.show({
                id: 'edit-fetch',
                title: 'Loading',
                message: locale.Post_Restricted_FetchingAuth, // existing string or close enough
                loading: true,
                autoClose: false,
                withCloseButton: false,
            });

            try {
                if (!apiProxyAgent) throw new Error("No agent");
                const res = await apiProxyAgent.post('uk.skyblur.post.getPost', {
                    input: {
                        uri: input.blurATUri as ResourceUri
                    }
                });

                if (res.ok && res.data) {
                    const data = res.data as { text: string, additional: string, message?: string, errorCode?: string };

                    if (data.errorCode) {
                        const code = data.errorCode;
                        let errorMsg = '';
                        if (code === 'NotFollower') {
                            errorMsg = locale.Post_Restricted_NotAuthorized_Followers;
                        } else if (code === 'NotFollowing') {
                            errorMsg = locale.Post_Restricted_NotAuthorized_Following;
                        } else if (code === 'NotMutual') {
                            errorMsg = locale.Post_Restricted_NotAuthorized_Mutual;
                        } else if (code === 'AuthRequired') {
                            errorMsg = locale.Post_Restricted_LoginRequired;
                        } else if (code === 'ContentMissing') {
                            errorMsg = locale.Post_Restricted_ContentMissing;
                        } else {
                            errorMsg = locale.Post_Restricted_NotAuthorized;
                        }

                        if (errorMsg) {
                            notifications.show({
                                title: 'Error',
                                message: errorMsg,
                                color: 'red',
                                icon: <X />,
                                autoClose: 10000,
                            });
                        }

                        // Fail safe: keep original input
                        setPrevBlur(input);

                    } else {
                        // Success
                        const newInput = {
                            ...input,
                            blur: {
                                ...input.blur,
                                text: data.text,
                                additional: data.additional
                            }
                        };
                        setPrevBlur(newInput);
                    }
                } else {
                    // Fallback
                    setPrevBlur(input);
                }
            } catch (e) {
                console.error("Pre-fetch failed", e);
                setPrevBlur(input);
                notifications.show({
                    title: 'Error',
                    message: "Failed to load restricted content.",
                    color: 'red'
                });
            } finally {
                notifications.hide('edit-fetch');
            }
        } else {
            setPrevBlur(input);
        }
        setMode("create")
    };

    const handleNew = () => {
        setPrevBlur(undefined)
        setMode("create")
    };

    // セッションの確認（マウント時）
    useEffect(() => {
        // 既に DID と ServiceURL がある場合は再チェックしない（HomeContentなどで取得済みの場合）
        if (did && serviceUrl) {
            setIsAuthenticated(true);
            return;
        }

        const checkSession = async () => {
            const result = await useXrpcAgentStore.getState().checkSession();
            setIsAuthenticated(result.authenticated);
        };

        checkSession();
    }, [did, serviceUrl]);

    // ログアウト等で DID がクリアされた場合、認証状態も未認証に戻す
    useEffect(() => {
        if (isAuthenticated === true && !did) {
            setIsAuthenticated(false);
        }
    }, [did, isAuthenticated]);

    const apiProxyAgent = useXrpcAgentStore((state) => state.apiProxyAgent);
    const isSessionChecked = useXrpcAgentStore((state) => state.isSessionChecked);
    const fetchUserProf = useXrpcAgentStore((state) => state.fetchUserProf);

    // プロフィールフェッチは DynamicHeader 側で行うため、ここでは行わない
    // とコメントしていたが、ConsoleContentでも必要なのであれば fetchUserProf を呼ぶ

    // モード調整
    useEffect(() => {
        if (did && mode === 'login') {
            setMode('menu');
        }
    }, [did, mode, setMode]);

    useEffect(() => {
        if (isAuthenticated === true && did && !userProf) {
            fetchUserProf();
        }
    }, [isAuthenticated, did, userProf, fetchUserProf]);

    // --- ここから早期リターン ---

    // 認証確認中、またはプロフィール取得中の場合
    if (isAuthenticated === null || (isAuthenticated === true && !userProf)) {
        return <PageLoading />;
    }

    // 未認証の場合
    if (isAuthenticated === false) {
        return (
            <div className="mx-auto max-w-screen-md px-4 pt-4 pb-12 flex flex-col items-center">
                <main className="w-full">
                    <AuthenticationTitle />
                </main>
            </div>
        );
    }

    // 認証済みの場合
    return (
        <div className="mx-auto max-w-screen-md px-4 pt-4 pb-12">
            <main>
                <div className="w-full">
                    {mode === 'create' ? (
                        <CreatePostForm setMode={setMode} prevBlur={prevBlur} onBack={() => setMode("menu")} />
                    ) : (
                        <div className="mx-auto max-w-screen-sm flex flex-col">
                            <div className="my-4 text-center">
                                {locale.Menu_LoginMessage.replace("{2}", (new Date().getHours() < 5 || new Date().getHours() >= 18) ? locale.Greeting_Night : (new Date().getHours() < 11) ? locale.Greeting_Morning : locale.Greeting_Day).replace("{1}", userProf?.displayName || 'No Name')}
                            </div>

                            <div className="flex justify-center gap-4 mb-8">
                                <Button leftSection={<Pencil size={14} />} variant="filled" onClick={() => handleNew()}>
                                    {locale.Menu_CreatePost}
                                </Button>
                            </div>

                            {isSessionChecked && did && (
                                <PostList handleEdit={handleEdit} agent={apiProxyAgent} did={did} pds={serviceUrl} />
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
