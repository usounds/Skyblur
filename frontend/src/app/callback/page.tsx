"use client";
import Loading from "@/components/Loading";
import { handleOAuth } from "@/logic/HandleOAuth";
import { useXrpcAgentStore } from "@/state/XrpcAgent";
import { useModeStore } from "@/state/Mode";
import { useLocaleStore } from "@/state/Locale";
import { getClientMetadata } from "@/types/ClientMetadataContext";
import { useEffect, useState } from "react";

export default function CallbackPage() {
    const setOauthUserAgent = useXrpcAgentStore(state => state.setOauthUserAgent);
    const setAgent = useXrpcAgentStore(state => state.setAgent);
    const setDid = useXrpcAgentStore(state => state.setDid);
    const setIsLoginProcess = useXrpcAgentStore(state => state.setIsLoginProcess);
    const setServiceUrl = useXrpcAgentStore(state => state.setServiceUrl);
    const setMode = useModeStore(state => state.setMode);
    const setUserProf = useXrpcAgentStore((state) => state.setUserProf);
    const locale = useLocaleStore((state) => state.localeData);
    const [isProcessing, setIsProcessing] = useState(true);

    useEffect(() => {
        let ignore = false;

        (async function () {
            if (ignore) return;

            setIsLoginProcess(true);

            try {
                const { success } = await handleOAuth(
                    getClientMetadata,
                    setAgent,
                    setUserProf,
                    setIsLoginProcess,
                    setOauthUserAgent,
                    setDid,
                    setServiceUrl,
                    locale
                );

                // コールバックURLを取得
                const callbackUrl = window.localStorage.getItem('oauth.callbackUrl');
                const redirectTo = callbackUrl || '/';

                if (success) {
                    setMode('menu');
                }

                // 成功・失敗に関わらずリダイレクト
                if (callbackUrl) {
                    window.localStorage.removeItem('oauth.callbackUrl');
                }

                // 認証成功時は認証処理中フラグを設定して、リダイレクト先でローディングを表示
                if (success) {
                    window.localStorage.setItem('oauth.authPending', 'true');
                }

                // 開発モードのエラーオーバーレイがrouter.pushをブロックするため、window.location.hrefを使用
                window.location.href = redirectTo;
                return; // リダイレクト後は処理を中断
            } catch (e) {
                console.error('OAuth error:', e);
                // 予期しないエラー時もリダイレクト
                const callbackUrl = window.localStorage.getItem('oauth.callbackUrl');
                const redirectTo = callbackUrl || '/';
                if (callbackUrl) {
                    window.localStorage.removeItem('oauth.callbackUrl');
                }
                window.location.href = redirectTo;
                return; // リダイレクト後は処理を中断
            }

            setIsLoginProcess(false);
            setIsProcessing(false);
        })();

        return () => {
            ignore = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (isProcessing) {
        return <Loading />;
    }

    return null;
}
