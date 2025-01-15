"use client"
import LanguageToggle from "@/components/LanguageToggle";
import { useAtpAgentStore } from "@/state/AtpAgent";
import { useLocaleStore } from "@/state/Locale";
import { getClientMetadata } from '@/types/ClientMetadataContext';
import { BrowserOAuthClient } from '@atproto/oauth-client-browser';
import Link from 'next/link';
import { useEffect } from "react";
import { GrSettingsOption } from "react-icons/gr";
import { useRouter } from 'next/navigation';

const Header = () => {
  const locale = useLocaleStore((state) => state.localeData);
  const agent = useAtpAgentStore((state) => state.agent);
  const setAgent = useAtpAgentStore((state) => state.setAgent);
  const did = useAtpAgentStore((state) => state.did);
  const setIsLoginProcess = useAtpAgentStore((state) => state.setIsLoginProcess);
  const setDid = useAtpAgentStore((state) => state.setDid);
  const localeString = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);
  const router = useRouter();

  useEffect(() => {
    setLocale(localeString)

    // クリーンアップ
    return () => {
    };    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setIsLoginProcess(false)

      window.localStorage.removeItem('oauth.code_verifier')
      window.localStorage.removeItem('oauth.pdsUrl')
      window.localStorage.removeItem('oauth.handle')

      router.push('/')

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
          <LanguageToggle />
          {agent &&
            <Link href="/settings" className="text-xl font-semibold text-white ml-2">
              <GrSettingsOption size={20} color="white" />
            </Link>
          }
        </div>
      </nav>
    </div>
  );
};

export default Header;