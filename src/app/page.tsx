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
            <><div className="flex items-center justify-center h-full text-gray-800 mt-2 mx-4">
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

              <div className="flex flex-col gap-2 p-2 md:p-3 max-w-screen-md ">
                {userProf &&
                  <>
                    <div className="flex items-center justify-between">
                      <Avatar userProf={userProf} />
                      <button
                        onClick={logout}
                        disabled={isLoading}
                        className="group relative inline-flex py-2 items-center justify-center overflow-hidden rounded-md bg-gray-800 px-3 font-medium text-neutral-200 duration-500 ml-auto"
                      >
                        <div className="translate-x-0 opacity-100 transition group-hover:-translate-x-[150%] group-hover:opacity-0 text-sm">{locale.Menu_Logout}</div>
                        <div className="absolute translate-x-[150%] opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100">
                          <svg
                            width="15"
                            height="15"
                            viewBox="0 0 15 15"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-6 w-6"
                          >
                            <path
                              d="M8.14645 3.14645C8.34171 2.95118 8.65829 2.95118 8.85355 3.14645L12.8536 7.14645C13.0488 7.34171 13.0488 7.65829 12.8536 7.85355L8.85355 11.8536C8.65829 12.0488 8.34171 12.0488 8.14645 11.8536C7.95118 11.6583 7.95118 11.3417 8.14645 11.1464L11.2929 8H2.5C2.22386 8 2 7.77614 2 7.5C2 7.22386 2.22386 7 2.5 7H11.2929L8.14645 3.85355C7.95118 3.65829 7.95118 3.34171 8.14645 3.14645Z"
                              fill="currentColor"
                              fillRule="evenodd"
                              clipRule="evenodd"
                            ></path>
                          </svg>
                        </div>
                      </button>
                    </div>


                    {mode === 'menu' &&
                      <>
                        <div className="flex flex-col items-center">
                          <div className="flex justify-center gap-4">
                            <div
                              onClick={() => setMode("create")}
                              className="flex flex-col border border-gray-400 rounded-md items-center p-2 w-[150px] h-[150px]">
                              <Image
                                src="/kkrn_icon_enpitsu_6.png"
                                alt="投稿"
                                width={100}
                                height={100}
                              />
                              <span className="mt-2 text-center">{locale.Menu_CreatePost}</span>
                            </div>
                            <div

                              onClick={() => setMode("delete")}
                              className="flex flex-col border border-gray-400 rounded-md items-center p-2 w-[150px] h-[150px]">
                              <Image
                                src="/kkrn_icon_gomibako_6.png"
                                alt="削除"
                                width={100}
                                height={100}
                              />
                              <span className="mt-2 text-center" >{locale.Menu_DeletePost}</span>
                            </div>
                          </div>
                        </div>
                      </>
                    }
                    {mode === 'create' &&
                      <>
                        <div onClick={() => setMode("menu")} className="block text-sm text-gray-400 mx-1 underline">{locale.Menu_Back}</div>
                        <CreatePostForm agent={agent} locale={locale} did={did}
                          userProf={userProf} />
                      </>
                    }
                    {mode === 'delete' &&
                      <>
                        <div onClick={() => setMode("menu")} className="block text-sm text-gray-400 mt-1 underline" >{locale.Menu_Back}</div>
                        <DeleteList agent={agent} locale={locale} did={did} />
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
