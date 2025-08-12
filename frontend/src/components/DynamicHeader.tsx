"use client";
import { AvatorDropdownMenu } from '@/components/AvatorDropdownMenu';
import LanguageToggle from '@/components/LanguageToggle';
import { SwitchColorMode } from '@/components/switchColorMode/SwitchColorMode';
import { handleOAuth } from "@/logic/HandleOAuth";
import { useLocaleStore } from '@/state/Locale';
import { useModeStore } from '@/state/Mode';
import { useXrpcAgentStore } from '@/state/XrpcAgent';
import { getClientMetadata } from '@/types/ClientMetadataContext';
import Link from 'next/link';
import { useEffect, useState } from "react";

const DynamicHeader = () => {
  const locale = useLocaleStore(state => state.localeData);
  const setOauthUserAgent = useXrpcAgentStore(state => state.setOauthUserAgent);
  const setAgent = useXrpcAgentStore(state => state.setAgent);
  const did = useXrpcAgentStore(state => state.did);
  const setDid = useXrpcAgentStore(state => state.setDid);
  const setIsLoginProcess = useXrpcAgentStore(state => state.setIsLoginProcess);
  const setBlueskyLoginMessage = useXrpcAgentStore(state => state.setBlueskyLoginMessage);
  const setServiceUrl = useXrpcAgentStore(state => state.setServiceUrl);
  const setMode = useModeStore(state => state.setMode);
  const setUserProf = useXrpcAgentStore((state) => state.setUserProf);
  const [isMounted, setIsMounted] = useState(false);
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


  return (
    <div className="flex flex-row items-center gap-3 sm:mt-0">
      <Link href="/termofuse" className="flex-none text-sm mr-2">
        {locale.Menu_TermOfUse}
      </Link>
      <AvatorDropdownMenu />
      <LanguageToggle />
      <SwitchColorMode />
    </div>
  );
};

export default DynamicHeader;
