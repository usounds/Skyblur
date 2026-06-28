"use client";
import { AuthenticationTitle } from "@/components/login/Login";
import PageLoading from "@/components/PageLoading";
import { PostList } from "@/components/PostList";
import { PostComposerRouteScaffold } from "@/components/post-composer/PostComposerRouteScaffold";
import { applyPasswordUnlockToInitialData, buildEditInitialData, loadGateInitialData } from "@/components/post-composer/EditPostLoader";
import { ScopeReloginNotice } from "@/components/ScopeReloginNotice";
import { useLocale } from "@/state/Locale";
import { useModeStore } from "@/state/Mode";
import { useXrpcAgentStore } from "@/state/XrpcAgent";
import type { PostComposerInitialData } from "@/types/postComposer";
import { PostListItem, VISIBILITY_PASSWORD } from "@/types/types";
import { Button } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { Pencil } from 'lucide-react';
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function ConsoleContent() {
    const did = useXrpcAgentStore((state) => state.did);
    const { localeData: locale } = useLocale();
    const userProf = useXrpcAgentStore((state) => state.userProf);
    const mode = useModeStore((state) => state.mode);
    const setMode = useModeStore((state) => state.setMode);
    const serviceUrl = useXrpcAgentStore((state) => state.serviceUrl);
    const router = useRouter();

    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [inlineEditInitialData, setInlineEditInitialData] = useState<PostComposerInitialData | null>(null);

    const handleEdit = async (input: PostListItem) => {
        const parts = input.blurATUri.split('/');
        const routeDid = parts[2];
        const routeRkey = parts[4];
        if (routeDid && routeRkey) {
            if (input.blur.visibility === VISIBILITY_PASSWORD && input.isDecrypt && input.encryptKey) {
                const gateInitialData = await loadGateInitialData(apiProxyAgent, routeDid, routeRkey);
                setInlineEditInitialData(applyPasswordUnlockToInitialData({
                    ...buildEditInitialData({
                        did: routeDid,
                        rkey: routeRkey,
                        cid: input.blurCid,
                        record: input.blur,
                    }),
                    ...gateInitialData,
                }, {
                    text: input.blur.text,
                    additional: input.blur.additional ?? "",
                    password: input.encryptKey,
                }));
                return;
            }
            router.push(`/console/posts/${encodeURIComponent(routeDid)}/${encodeURIComponent(routeRkey)}/edit`);
            return;
        }
    };

    const isSessionChecked = useXrpcAgentStore((state) => state.isSessionChecked);

    // セッションの確認（マウント時）
    useEffect(() => {
        const currentState = useXrpcAgentStore.getState();

        if (isSessionChecked || currentState.isSessionChecked) {
            setIsAuthenticated(!!currentState.did);
            return;
        }

        // 既に DID と ServiceURL がある場合は再チェックしない（HomeContentなどで取得済みの場合）
        if (did && serviceUrl) {
            setIsAuthenticated(true);
            return;
        }

        let isActive = true;

        void useXrpcAgentStore.getState().checkSession().then((result) => {
            if (isActive) setIsAuthenticated(result.authenticated);
        }).catch(() => {
            if (isActive) setIsAuthenticated(false);
        });

        return () => {
            isActive = false;
        };
    }, [did, isSessionChecked, serviceUrl]);

    // ログアウト等で DID がクリアされた場合、認証状態も未認証に戻す
    useEffect(() => {
        if (isAuthenticated === true && !did) {
            setIsAuthenticated(false);
        }
    }, [did, isAuthenticated]);

    const apiProxyAgent = useXrpcAgentStore((state) => state.apiProxyAgent);
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

    // 認証確認中のみ待機する。プロフィール取得失敗でコンソール全体は止めない。
    if (isAuthenticated === null) {
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

    if (inlineEditInitialData) {
        return (
            <PostComposerRouteScaffold
                mode="edit"
                initialEditData={inlineEditInitialData}
                onExit={() => setInlineEditInitialData(null)}
            />
        );
    }

    // 認証済みの場合
    return (
        <div className="mx-auto max-w-screen-md px-4 pt-4 pb-12">
            <main>
                <div className="w-full">
                    <ScopeReloginNotice />
                    <div className="mx-auto max-w-screen-sm flex flex-col">
                        <div className="my-4 text-center" style={{ animation: 'fadeInUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) both' }}>
                            {locale.Menu_LoginMessage.replace("{2}", (new Date().getHours() < 5 || new Date().getHours() >= 18) ? locale.Greeting_Night : (new Date().getHours() < 11) ? locale.Greeting_Morning : locale.Greeting_Day).replace("{1}", userProf?.displayName || userProf?.handle || did || 'User')}
                        </div>

                        <div className="flex justify-center gap-4 mb-8" style={{ animation: 'fadeInUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) 0.1s both' }}>
                            <Button component={Link} href="/console/posts/new" leftSection={<Pencil size={14} />} variant="filled">
                                {locale.Menu_CreatePost}
                            </Button>
                        </div>

                        {isSessionChecked && did && (
                            <PostList handleEdit={handleEdit} agent={apiProxyAgent} did={did} />
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
