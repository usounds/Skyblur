import React, { useEffect } from "react";
import { useXrpcStore } from '@/state/Xrpc';
import { isDidString } from "@/logic/HandleBluesky"
import { configureOAuth, getSession, OAuthUserAgent } from '@atcute/oauth-browser-client';
import { XRPC } from '@atcute/client';
import { useNavigate } from 'react-router-dom';

const BlueskySession: React.FC = () => {
    const did = useXrpcStore((state) => state.did);
    const loginXrpc = useXrpcStore((state) => state.loginXrpc);
    const setLoginXrpc = useXrpcStore((state) => state.setLoginXrpc);
    const setUserProf = useXrpcStore((state) => state.setUserProf);
    const setIsLoginProcess = useXrpcStore((state) => state.setIsLoginProcess);
    const setHandleMessage = useXrpcStore((state) => state.setBlueskyLoginMessage);
    const navigate = useNavigate();

    useEffect(() => {
        // 非同期関数を定義
        const fetchSession = async () => {
            if (!loginXrpc && did && isDidString(did)) {
                try {
                    configureOAuth({
                        metadata: {
                            client_id: import.meta.env.VITE_OAUTH_CLIENT_ID,
                            redirect_uri: import.meta.env.VITE_OAUTH_REDIRECT_URI,
                        },
                    });

                    const session = await getSession(did, { allowStale: true });
                    if (session.token.expires_at && session.token.expires_at > Date.now()) {

                        const agent = new OAuthUserAgent(session);
                        const xrpc = new XRPC({ handler: agent });

                        setLoginXrpc(xrpc)
                        const ret = await xrpc.get("app.bsky.actor.getProfile", { params: { actor: agent.sub } })
                        console.log(ret.headers.status)
                        if (ret.headers.status !== '401') {
                            setUserProf(ret.data)
                            navigate('/mypage')
                        }
                    } else {
                        setHandleMessage('7日間経過したので、再ログインしてください')
                    }
                } catch (error) {
                    console.error('Failed to fetch session:', error);
                }
            }
            setIsLoginProcess(false)
        };

        // 非同期関数を実行
        fetchSession();

        // クリーンアップ関数（必要なら）
        return () => { };

        // 注意: 依存配列には必要な変数を含めてください
    }, [loginXrpc, did]);




    return (
        <>
        </>
    );
};

export default BlueskySession;