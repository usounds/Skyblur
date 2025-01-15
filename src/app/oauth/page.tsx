"use client"
export const runtime = 'edge';
import Header from "@/components/Header";
import { handleOAuth } from "@/logic/HandleOAuth";
import { useAtpAgentStore } from "@/state/AtpAgent";
import { useLocaleStore } from "@/state/Locale";
import { useModeStore } from "@/state/Mode";
import { getClientMetadata } from '@/types/ClientMetadataContext';
import { useRouter } from 'next/navigation';
import { useEffect } from "react";
import BeatLoader from "react-spinners/BeatLoader";

export default function Home() {
    const localeString = useLocaleStore((state) => state.locale);
    const setLocale = useLocaleStore((state) => state.setLocale);
    const did = useAtpAgentStore((state) => state.did);
    const setIsLoginProcess = useAtpAgentStore((state) => state.setIsLoginProcess);
    const setUserProf = useAtpAgentStore((state) => state.setUserProf);
    const setBlueskyLoginMessage = useAtpAgentStore((state) => state.setBlueskyLoginMessage);
    const setAgent = useAtpAgentStore((state) => state.setAgent);
    const setDid = useAtpAgentStore((state) => state.setDid);
    const setMode = useModeStore((state) => state.setMode);
    const locale = useLocaleStore((state) => state.localeData);
    const router = useRouter();

    let ignore = false

    useEffect(() => {
        if (ignore) {
            console.log("useEffect duplicate call")
            return
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
        ignore = true

        setLocale(localeString)

        if (did) {
            console.log("has active session")
            router.push('/')
            return
        }

        (
            async function () {
                setIsLoginProcess(true)

                const ret = await handleOAuth(
                    getClientMetadata,
                    setAgent,
                    setUserProf,
                    setIsLoginProcess,
                    setDid,
                    setBlueskyLoginMessage
                );

                if (ret) {
                    setMode('menu')
                    router.push('/')

                }
                setIsLoginProcess(false)

            })();


        // クリーンアップ
        return () => {
        };    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <main >
            <Header />
            <div className="flex flex-col items-center justify-center h-full mt-2 text-gray-600">
                <p className="mb-2"><BeatLoader /></p>
                {locale.Home_inAuthProgress}
            </div>
        </main >
    );
}
