"use client";

import LanguageToggle from '@/components/LanguageToggle';
import { handleOAuth } from "@/logic/HandleOAuth";
import { useLocaleStore } from '@/state/Locale';
import { useModeStore } from '@/state/Mode';
import { useXrpcAgentStore } from '@/state/XrpcAgent';
import { getClientMetadata } from '@/types/ClientMetadataContext';
import { OAuthUserAgent, deleteStoredSession, getSession } from '@atcute/oauth-browser-client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from "react";
import { GoGear } from 'react-icons/go';
import BeatLoader from "react-spinners/BeatLoader";

const DynamicHeader = () => {
  const locale = useLocaleStore(state => state.localeData);
  const agent = useXrpcAgentStore(state => state.agent);
  const setOauthUserAgent = useXrpcAgentStore(state => state.setOauthUserAgent);
  const setAgent = useXrpcAgentStore(state => state.setAgent);
  const did = useXrpcAgentStore(state => state.did);
  const setDid = useXrpcAgentStore(state => state.setDid);
  const setIsLoginProcess = useXrpcAgentStore(state => state.setIsLoginProcess);
  const setBlueskyLoginMessage = useXrpcAgentStore(state => state.setBlueskyLoginMessage);
  const setServiceUrl = useXrpcAgentStore(state => state.setServiceUrl);
  const setMode = useModeStore(state => state.setMode);
  const setUserProf = useXrpcAgentStore((state) => state.setUserProf);
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [isLogoutProcess, setIsLogoutProcess] = useState(false);
  const localeString = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);
  let ignore = false

  useEffect(() => {
    if (ignore) {
      console.log("useEffect duplicate call")
      return
    }

    setIsMounted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ignore = true

    setLocale(localeString)

    if (did) {
      console.log("has active session")
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
          setOauthUserAgent,
          setDid,
          setBlueskyLoginMessage,
          setServiceUrl
        );

        if (ret) {
          setMode('menu')

        }
        setIsLoginProcess(false)

      })();


    // クリーンアップ
    return () => {
    };
  }, [])

  if (!isMounted) {
    return (
      <></>
    );
  }

  const logout = async () => {
    try {
      setIsLogoutProcess(true)

      const session = await getSession(did as `did:${string}:${string}`, { allowStale: true });
      const agent = new OAuthUserAgent(session);

      await agent.signOut();

      setDid('');
      setIsLoginProcess(false);
      setAgent(null);

      window.localStorage.removeItem('oauth.did');
      window.localStorage.removeItem('oauth.handle');

      router.push('/');
    } catch {
      deleteStoredSession(did as `did:${string}:${string}`);

      setAgent(null);
      setDid('');
      setIsLoginProcess(false);

      router.push('/');
    }
  };

  return (
    <div className="flex flex-row items-center gap-2 text-gray-800 mt-2 sm:mt-0">
      {agent && (
        <>
          <div
            className="flex-none text-sm font-semibold text-white mr-2 cursor-pointer"
            onClick={logout}
          >
            {isLogoutProcess
              ? <BeatLoader color='#b7b7b7'/>
              : locale.Menu_Logout
            }
          </div>
        </>
      )}
      <Link href="/termofuse" className="flex-none text-sm font-semibold text-white mr-2">
        {locale.Menu_TermOfUse}
      </Link>
      <LanguageToggle />
      {agent && (
        <Link href="/settings" className="text-xl font-semibold text-white ml-2">
          <GoGear size={22} color="white" />
        </Link>
      )}
    </div>
  );
};

export default DynamicHeader;
