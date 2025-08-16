"use client";
import { AvatorDropdownMenu } from '@/components/AvatorDropdownMenu';
import LanguageToggle from '@/components/LanguageToggle';
import { SwitchColorMode } from '@/components/switchColorMode/SwitchColorMode';
import { useLocaleStore } from '@/state/Locale';
import { useModeStore } from '@/state/Mode';
import { useXrpcAgentStore } from '@/state/XrpcAgent';
//import { getClientMetadata } from '@/types/ClientMetadataContext';
import { fetchServiceEndpointWithCache } from "@/logic/HandleBluesky";
import { AppBskyActorDefs } from '@atcute/bluesky';
import { Client, simpleFetchHandler } from '@atcute/client';
import { notifications } from '@mantine/notifications';
import Link from 'next/link';
import { useEffect, useState } from "react";
import { HiX } from "react-icons/hi";

const DynamicHeader = () => {
  const locale = useLocaleStore(state => state.localeData);
  const setAgent = useXrpcAgentStore(state => state.setAgent);
  const did = useXrpcAgentStore(state => state.did);
  const setDid = useXrpcAgentStore(state => state.setDid);
  const setIsLoginProcess = useXrpcAgentStore(state => state.setIsLoginProcess);
  const setServiceUrl = useXrpcAgentStore(state => state.setServiceUrl);
  const setMode = useModeStore(state => state.setMode);
  const setUserProf = useXrpcAgentStore((state) => state.setUserProf);
  const [isMounted, setIsMounted] = useState(false);
  const localeString = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);
  let ignore = false

  useEffect(() => {
    if (localeString) {
      setLocale(localeString);
    }
  }, [localeString, setLocale]);
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

        const host = new URL(origin).host;
        let apiHost = 'api.skyblur.uk'
        if (host?.endsWith('usounds.work')) {
          apiHost = 'skyblurapi.usounds.work'
        }

        const result = await fetch(`https://${apiHost}/oauth/getUserProfile`, {
          method: "GET",
          credentials: 'include',
        })

        if (result.ok) {
          const profileData = await result.json() as unknown as AppBskyActorDefs.ProfileViewDetailed
          setMode('menu')
          setUserProf(profileData)

          const host = new URL(origin).host;
          const publicAgent = new Client({
            handler: simpleFetchHandler({
              service: `https://${apiHost}`,
              fetch: (input, init = {}) => {
                return fetch(input, {
                  ...init,
                  credentials: 'include', // ここで指定
                });
              },
            }),
          });
          const serviceUrl = await fetchServiceEndpointWithCache(profileData.did, false)
          setAgent(publicAgent)
          setDid(profileData.did)
          setServiceUrl(serviceUrl || '')
          setIsLoginProcess(false)

          return
        } else {

          notifications.show({
            title: 'Error',
            message: 'System Error: Can not get profile data',
            color: 'red',
            icon: <HiX />
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
