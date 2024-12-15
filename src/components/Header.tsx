"use client"
import LanguageSelect from "@/components/LanguageSelect";
import { useAtpAgentStore } from "@/state/AtpAgent";
import { useLocaleStore } from "@/state/Locale";
import { getClientMetadata } from '@/types/ClientMetadataContext';
import { BrowserOAuthClient,OAuthSession } from '@atproto/oauth-client-browser';
import Link from 'next/link';
import React from 'react';
import { useEffect } from "react";
import { Agent } from '@atproto/api';
import { useModeStore } from "@/state/Mode";

const Header = () => {
  const locale = useLocaleStore((state) => state.localeData);
  const agent = useAtpAgentStore((state) => state.agent);
  const setAgent = useAtpAgentStore((state) => state.setAgent);
  const did = useAtpAgentStore((state) => state.did);
  const setDid = useAtpAgentStore((state) => state.setDid);
  const setUserProf = useAtpAgentStore((state) => state.setUserProf);
  const setIsLoginProcess = useAtpAgentStore((state) => state.setIsLoginProcess);
  const setBlueskyLoginMessage = useAtpAgentStore((state) => state.setBlueskyLoginMessage);
  const setMode = useModeStore((state) => state.setMode);

  let ignore = false

  useEffect(() => {
    if (ignore) {
      console.log("useEffect duplicate call")
      return
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ignore = true

    if(did) {
      console.log("has active session")
      return        
    }


    (
      async function () {

        let result

        const localState = window.localStorage.getItem('oauth.code_verifier')
        const localPdsUrl = window.localStorage.getItem('oauth.pdsUrl')

        try {
          if (localState && localPdsUrl) {
            const browserClient = new BrowserOAuthClient({
              clientMetadata: getClientMetadata(),
              handleResolver: localPdsUrl,
            })

            result = await browserClient.init() as undefined | { session: OAuthSession; state?: string | undefined };

          }
        } catch (e) {
          console.error(e)
          setBlueskyLoginMessage("OAuth認証に失敗しました")
          setIsLoginProcess(false)
          return
        }

        if (result) {
          const { session, state } = result
          //OAuth認証から戻ってきた場合
          if (state != null) {
            //stateがズレている場合はエラー
            if (state !== localState) {
              setBlueskyLoginMessage("stateが一致しません")
              setIsLoginProcess(false)
              return

            }

            const agent = new Agent(session)
            setAgent(agent)

            console.log(`${agent.assertDid} was successfully authenticated (state: ${state})`)
            const userProfile = await agent.getProfile({ actor: agent.assertDid })
            setUserProf(userProfile.data)
            setIsLoginProcess(false)
            setDid(agent.assertDid)
            setMode('menu')
            return

            //セッションのレストア
          } else {
            console.log(`${session.sub} was restored (last active session)`)
            const agent = new Agent(session)
            setAgent(agent)
            const userProfile = await agent.getProfile({ actor: agent.assertDid })
            setUserProf(userProfile.data)
            setIsLoginProcess(false)
            setDid(agent.assertDid)
            setMode('menu')
            return

          }

        } else {
          console.log(`OAuth未認証です`)
          setIsLoginProcess(false)
        }

      })();


    // クリーンアップ
    return () => {
    };


    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const logout = async (): Promise<void> => {
    try {

      const localPdsUrl = window.localStorage.getItem('oauth.pdsUrl') || 'https://bsky.social'

      const browserClient = new BrowserOAuthClient({
        clientMetadata: getClientMetadata(),
        handleResolver: localPdsUrl,
      })

      browserClient.revoke(did)

      setAgent(null)
      setDid('')

      window.localStorage.removeItem('oauth.code_verifier')
      window.localStorage.removeItem('oauth.pdsUrl')
      window.localStorage.removeItem('oauth.handle')


    } catch (e) {
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

          {agent &&
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