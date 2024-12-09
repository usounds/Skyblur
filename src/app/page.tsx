"use client";
export const runtime = 'edge';
import Image from "next/image";
import { useState, useEffect } from "react";
import Link from 'next/link'
import { AtpAgent, Agent, AppBskyActorDefs } from '@atproto/api'
import { LoginForm } from "../components/LoginForm"
import { CreatePostForm } from "../components/CreatePost"
import { BrowserOAuthClient, OAuthSession } from '@atproto/oauth-client-browser'
import { clientMetadataByEnv } from '../types/ClientMetadataContext'
import { OAuthClientMetadataInput } from '@atproto/oauth-types';
import ja from "../locales/ja"
import en from "../locales/en"
import { Avatar } from "../components/Avatar";
import { DeleteList } from "../components/DeleteList";
import LanguageSelect from "../components/LanguageSelect";
let agent: Agent

export default function Home() {
  const [handle, setHandle] = useState<string>("")
  const [did, setDid] = useState<string>("")
  const [locale, setLocale] = useState(ja)
  const [selectedLocale, setSelectedLocale] = useState<string>('ja');
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isLoginToBsky, setIsLoginToBsky] = useState<boolean>(false)
  const [blueskyLoginMessage, setBlueskyLoginMessage] = useState("")
  const [mode, setMode] = useState("login")
  const [userProf, setUserProf] = useState<AppBskyActorDefs.ProfileViewDetailed>()
  const [windowWidth, setWindowWidth] = useState(0);

  const publicAgent = new AtpAgent({
    service: "https://api.bsky.app"
  })


  const changeLocale = (localeParam: string) => {
    // ここで実際のロジック（例: 言語の変更など）を実行します
    console.log(`Locale changed to: ${locale}`);
    setSelectedLocale(localeParam)
    window.localStorage.setItem('preference.locale', localeParam)
    if (localeParam == 'ja') setLocale(ja)
    if (localeParam == 'en') setLocale(en)
  };

  function getClientMetadata(): OAuthClientMetadataInput | undefined {
    let env
    const origin = window.location.hostname

    if (process.env.NODE_ENV === 'production') {
      if (origin.includes('preview.skyblur.uk')) {
        env = 'preview'

      } else {
        env = 'production'
      }

    } else {
      env = 'local'

    }

    let ret = clientMetadataByEnv[env];

    return ret;
  }

  const metadata = getClientMetadata();

  let browserClient: BrowserOAuthClient = new BrowserOAuthClient({
    clientMetadata: metadata,
    handleResolver: "https://bsky.social"
  })

  let ignore = false

  useEffect(() => {

    // 初期ウィンドウ幅の設定
    setWindowWidth(window.innerWidth);

    // リサイズイベントリスナーの設定
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);



    (
      async function () {
        if (ignore) {
          console.log("useEffect duplicate call")
          return
        }
        ignore = true

        let result

        const localState = window.localStorage.getItem('oauth.code_verifier')
        const localPdsUrl = window.localStorage.getItem('oauth.pdsUrl')
        const localHandle = window.localStorage.getItem('oauth.handle')
        const localLocale = window.localStorage.getItem('preference.locale')

        if (localLocale) changeLocale(localLocale)

        if (localHandle) setHandle(localHandle)

        try {
          if (localState && localPdsUrl) {
            browserClient = new BrowserOAuthClient({
              clientMetadata: metadata,
              handleResolver: localPdsUrl,
            })

            result = await browserClient.init() as undefined | { session: OAuthSession; state?: string | undefined };

          }
        } catch (e) {
          setBlueskyLoginMessage("OAuth認証に失敗しました")
        }

        if (result) {
          const { session, state } = result
          //OAuth認証から戻ってきた場合
          if (state != null) {
            //stateがズレている場合はエラー
            if (state !== localState) {
              setBlueskyLoginMessage("stateが一致しません")
              setIsLoading(false)
              return

            }

            agent = new Agent(session)

            console.log(`${agent.assertDid} was successfully authenticated (state: ${state})`)
            const userProfile = await agent.getProfile({ actor: agent.assertDid })
            setUserProf(userProfile.data)
            setIsLoading(false)
            setIsLoginToBsky(true)
            setDid(agent.assertDid)
            setMode('menu')
            return

            //セッションのレストア
          } else {
            console.log(`${session.sub} was restored (last active session)`)
            agent = new Agent(session)
            const userProfile = await agent.getProfile({ actor: agent.assertDid })
            setUserProf(userProfile.data)
            setIsLoginToBsky(true)
            setIsLoading(false)
            setDid(agent.assertDid)
            setMode('menu')
            return

          }

        } else {
          console.log(`OAuth未認証です`)
        }

        setIsLoading(false)
      })();

    //setIsLoading(false)

    // クリーンアップ
    return () => {
    };


  }, [])



  const logout = async (): Promise<void> => {
    try {
      window.localStorage.removeItem('oauth.code_verifier')
      window.localStorage.removeItem('oauth.pdsUrl')
      window.localStorage.removeItem('oauth.handle')
      setHandle('')

      browserClient?.revoke(did)

    } catch (e) {
      console.error(e)
    }
    setIsLoginToBsky(false)

  }


  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newLocale = event.target.value;
    setSelectedLocale(newLocale); // 選択された値をステートに設定
    changeLocale(newLocale); // changeLocale を呼び出す
  };

  return (


    <div className="">

      <div className="flex flex-wrap w-full text-sm py-2 bg-neutral-800">
        <nav className="px-4 md:px-8 w-full mx-auto flex justify-between items-center flex-row">
          <Link href={"/"} className="text-xl font-semibold text-white">
            Skyblur
          </Link>
          <div className="flex flex-row items-center gap-2 text-gray-800 mt-2 sm:mt-0">
            {isLoginToBsky &&
              <>
                <div onClick={logout} className="flex-none text-sm font-semibold text-white mr-2">
                  {locale.Menu_Logout} 
                </div>
              </>
            }
            <Link href={"/termofuse"} className="flex-none text-sm font-semibold text-white mr-2">
              {locale.Menu_TermOfUse}
            </Link>
            <LanguageSelect
              selectedLocale={selectedLocale}
              onChange={(locale) => handleChange({ target: { value: locale } } as React.ChangeEvent<HTMLSelectElement>)}
            />
          </div>
        </nav>
      </div>

      <main className="text-gray-800 ">

        <div className="mx-auto max-w-screen-md ">
          {!isLoginToBsky &&
            <><div className="flex items-center justify-center h-full text-gray-800 mt-4 mx-4">
              {locale.Home_Welcome}
            </div>

              <div className="row-start-3 flex gap-6 flex-wrap items-center justify-center mt-2">
                <>{(isLoading) ? <>

                  <span className="animate-spin inline-block size-4 mr-2 border-[3px] border-current border-t-transparent text-gray-700 rounded-full" role="status" aria-label="loading">
                    <span className="sr-only">Loading...</span>
                  </span>
                  {locale.Home_inAuthProgress}
                </> :
                  <LoginForm
                    handle={handle}
                    setHandle={setHandle}
                    publicAgent={publicAgent}
                    locale={locale}
                    browserClient={browserClient}
                  />

                }</>
              </div>
            </>
          }

          {isLoginToBsky &&

            <>

              <div className="w-full">
                {userProf &&
                  <>
                    {mode === 'menu' &&
                      <>
                        <div className="mt-4 mx-auto max-w-screen-sm flex flex-col  ">
                          <div className="flex justify-center my-4">
                              {locale.Menu_LoginMessage.replace("{1}", userProf.displayName||'No Name')}
                            </div>

                          <div className="flex justify-center gap-4 mb-8">
                            <button onClick={() => setMode("create")} className="relative z-0 h-12 rounded-full bg-blue-500 px-6 text-neutral-50 after:absolute after:left-0 after:top-0 after:-z-10 after:h-full after:w-full after:rounded-full after:bg-blue-500 hover:after:scale-x-125 hover:after:scale-y-150 hover:after:opacity-0 hover:after:transition hover:after:duration-500">

                              <>
                                {locale.Menu_CreatePost}
                              </>
                            </button>

                          </div>

                          <DeleteList agent={agent} locale={locale} did={did} />

                        </div>
                      </>
                    }
                    {mode === 'create' &&
                      <>
                        <div className="flex justify-center mt-4">
                          <div onClick={() => setMode("menu")} className="block text-sm text-gray-400 mx-1 underline ">{locale.Menu_Back}</div>
                        </div>
                        <CreatePostForm agent={agent} locale={locale} did={did} setMode={setMode}
                          userProf={userProf} />
                      </>
                    }
                  </>
                }
              </div>

            </>

          }

        </div>

      </main>

    </div>
  );
}
