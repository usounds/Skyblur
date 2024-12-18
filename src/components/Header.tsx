"use client"
import LanguageSelect from "@/components/LanguageSelect";
import { handleAtCuteOauth, isDidString } from "@/logic/HandleOAuth";
import { useLocaleStore } from "@/state/Locale";
import { useModeStore } from "@/state/Mode";
import { useXrpcStore } from "@/state/Xrpc";
import { OAuthUserAgent, deleteStoredSession, getSession } from '@atcute/oauth-browser-client';
import Link from 'next/link';
import React, { useEffect } from 'react';

const Header = () => {
  const locale = useLocaleStore((state) => state.localeData);
  const setUserProf = useXrpcStore((state) => state.setUserProf);
  const setIsLoginProcess = useXrpcStore((state) => state.setIsLoginProcess);
  const setDid = useXrpcStore((state) => state.setDid);
  const setBlueskyLoginMessage = useXrpcStore((state) => state.setBlueskyLoginMessage);
  const setMode = useModeStore((state) => state.setMode);
  const did = useXrpcStore((state) => state.did);
  const setLoginXrpc = useXrpcStore((state) => state.setLoginXrpc);
  const loginXrpc = useXrpcStore((state) => state.loginXrpc);

  let ignore = false

  useEffect(() => {

    if (ignore) {
      console.log("useEffect duplicate call")
      return
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ignore = true;

    (
      async function () {

        if(loginXrpc) return
        setIsLoginProcess(true)

        const ret = await handleAtCuteOauth(
          setUserProf,
          setLoginXrpc,
          did,
          setBlueskyLoginMessage
        );

        if (ret) {
          setMode('menu')

        }
        setIsLoginProcess(false)

      })();


    // クリーンアップ
    return () => {
    };    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale])

  const logout = async (): Promise<void> => {

    if (!isDidString(did)) return
    try {

      const session = await getSession(did, { allowStale: true });

      const agent = new OAuthUserAgent(session);
      await agent.signOut();

      setLoginXrpc(undefined)
      setDid('')
      setIsLoginProcess(false)
      setMode('login')
      window.localStorage.removeItem('oauth.handle')


    } catch (e) {
      deleteStoredSession(did)
      console.error(e)
    }

  }

  return (
    <div className="flex flex-wrap w-full text-sm py-2 bg-neutral-800">
      <nav className="px-4 md:px-8 w-full mx-auto flex justify-between items-center flex-row">
        <Link href="/" className="text-xl font-semibold text-white">
          Skyblur
        </Link>
        <div className="flex flex-row items-center gap-2 text-gray-800 mt-2 sm:mt-0">

          {loginXrpc &&
            <>
              <div className="flex-none text-sm font-semibold text-white mr-2" onClick={logout}>
                {locale.Menu_Logout}
              </div>
            </>
          }
          <Link href="/termofuse" className="flex-none text-sm font-semibold text-white mr-2">
            {locale.Menu_TermOfUse}
          </Link>
          <LanguageSelect />
        </div>
      </nav>
    </div>
  );
};

export default Header;