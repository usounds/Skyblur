"use client";
import { AvatorDropdownMenu } from '@/components/AvatorDropdownMenu';
import LanguageToggle from '@/components/LanguageToggle';
import { SwitchColorMode } from '@/components/switchColorMode/SwitchColorMode';
import en from "@/locales/en";
import ja from "@/locales/ja";
import { handleOAuth } from "@/logic/HandleOAuth";
import { useLocaleStore } from '@/state/Locale';
import { useModeStore } from '@/state/Mode';
import { useXrpcAgentStore } from '@/state/XrpcAgent';
import { getClientMetadata } from '@/types/ClientMetadataContext';
import { notifications } from '@mantine/notifications';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from "react";
import { X } from 'lucide-react';

const DynamicHeader = () => {
  const locale = useLocaleStore(state => state.localeData);
  const setOauthUserAgent = useXrpcAgentStore(state => state.setOauthUserAgent);
  const setAgent = useXrpcAgentStore(state => state.setAgent);
  const did = useXrpcAgentStore(state => state.did);
  const setDid = useXrpcAgentStore(state => state.setDid);
  const setIsLoginProcess = useXrpcAgentStore(state => state.setIsLoginProcess);
  const setServiceUrl = useXrpcAgentStore(state => state.setServiceUrl);
  const setMode = useModeStore(state => state.setMode);
  const setUserProf = useXrpcAgentStore((state) => state.setUserProf);
  const [isMounted, setIsMounted] = useState(false);
  const localeString = useLocaleStore((state) => state.locale);
  const setLocaleData = useLocaleStore((state) => state.setLocaleData);
  const [rehydrated, setRehydrated] = useState(false);
  const searchParams = useSearchParams();
  const langParam = searchParams.get('lang');
  const router = useRouter();

  let ignore = false

  useEffect(() => {
    if (locale !== null) {
      setRehydrated(true);
    }
  }, [locale]);

  useEffect(() => {
    if (!rehydrated) return; 

    if (!langParam) {
      const currentUrl = window.location.pathname;
      router.replace(`${currentUrl}?lang=${localeString || 'ja'}`);
      return;
    }

    if (langParam === 'en') setLocaleData(en);
    else setLocaleData(ja);
  }, [langParam, router, rehydrated, localeString, setLocaleData]);


  useEffect(() => {
    if (ignore) {
      console.log("useEffect duplicate call")
      return
    }

    setIsMounted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ignore = true

    if (did) {
      console.log("has active session")
      return
    }

    (
      async function () {
        setIsLoginProcess(true)

        const { success, message } = await handleOAuth(
          getClientMetadata,
          setAgent,
          setUserProf,
          setIsLoginProcess,
          setOauthUserAgent,
          setDid,
          setServiceUrl,
          locale
        );

        if (success) {
          setMode('menu')

        } else if (!success && message) {
          notifications.show({
            title: 'Error',
            message: message,
            color: 'red',
            icon: <X />
          });
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
