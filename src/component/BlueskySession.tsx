import { fetchSession } from "@/logic/HandleBluesky";
import { useXrpcStore } from '@/state/Xrpc';
import React, { useEffect } from "react";
import { useNavigate } from 'react-router-dom';

const BlueskySession: React.FC = () => {
    const did = useXrpcStore((state) => state.did);
    const loginXrpc = useXrpcStore((state) => state.loginXrpc);
    const isLoginProcess = useXrpcStore((state) => state.isLoginProcess);
    const navigate = useNavigate();

    useEffect(() => {
        console.log('useEffect BlueskySession')
        console.log(isLoginProcess)
        if(isLoginProcess) return
        // 非同期関数を定義
        const getSession = async () => {
            if (!isLoginProcess && !loginXrpc) {
                const ret = await fetchSession(loginXrpc, did, useXrpcStore.getState().setBlueskyLoginMessage, useXrpcStore.getState().setIsLoginProcess, useXrpcStore.getState().setLoginXrpc, useXrpcStore.getState().setUserProf)

                if (!ret) {
                    return
                }

            }else if(loginXrpc){
                navigate('/');

            }
        };

        // 非同期関数を実行
        getSession();

        // クリーンアップ関数（必要なら）
        return () => { };

        // 注意: 依存配列には必要な変数を含めてください
    }, [loginXrpc, did,isLoginProcess]);

    return (
        <>
        </>
    );
};

export default BlueskySession;