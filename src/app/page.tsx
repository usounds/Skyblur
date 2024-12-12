"use client";
export const runtime = 'edge';
import { useState, useEffect } from "react";
import Link from 'next/link'
import { AtpAgent, Agent, AppBskyActorDefs } from '@atproto/api'
import { LoginForm } from "@/components/LoginForm"
import { CreatePostForm } from "@/components/CreatePost"
import { BrowserOAuthClient, OAuthSession } from '@atproto/oauth-client-browser'
import { getClientMetadata } from '@/types/ClientMetadataContext'
import ja from "@/locales/ja"
import en from "@/locales/en"
import { DeleteList } from "@/components/DeleteList";
import LanguageSelect from "@/components/LanguageSelect";
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

  let browserClient: BrowserOAuthClient

  const changeLocale = (localeParam: string) => {
    // ここで実際のロジック（例: 言語の変更など）を実行します
    setSelectedLocale(localeParam)
    window.localStorage.setItem('preference.locale', localeParam)
    if (localeParam == 'ja') setLocale(ja)
    if (localeParam == 'en') setLocale(en)
  };

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

        if (localLocale && typeof localLocale === 'string') {
          changeLocale(localLocale)
        } else {
          const userLanguages = navigator.language;
          console.log(userLanguages)
          if (userLanguages.startsWith('ja')) {
            changeLocale('ja')
          } else {
            changeLocale('en')

          }
        }

        if (localHandle) setHandle(localHandle)

        try {
          if (localState && localPdsUrl) {
            browserClient = new BrowserOAuthClient({
              clientMetadata: getClientMetadata(),
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
      const localPdsUrl = window.localStorage.getItem('oauth.pdsUrl') || ''

      browserClient = new BrowserOAuthClient({
        clientMetadata: getClientMetadata(),
        handleResolver: localPdsUrl
      })

      browserClient.revoke(did)

      window.localStorage.removeItem('oauth.code_verifier')
      window.localStorage.removeItem('oauth.pdsUrl')
      window.localStorage.removeItem('oauth.handle')
      setHandle('')


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
                  <>
                    <LoginForm
                      handle={handle}
                      setHandle={setHandle}
                      publicAgent={publicAgent}
                      locale={locale}
                    />

                  </>

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
                            {locale.Menu_LoginMessage.replace("{1}", userProf.displayName || 'No Name')}
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
                        <CreatePostForm agent={agent} locale={locale} did={did} setMode={setMode}
                          userProf={userProf} />
                        <div className="flex justify-center mt-4">
                          <button onClick={() => {
                            setMode("menu");
                            window.scrollTo(0, 0); // ページを一番上までスクロール
                          }} className="group relative inline-flex h-12 items-center justify-center overflow-hidden rounded-md bg-gray-600 px-6 font-medium text-neutral-200"><span>{locale.Menu_Back}</span><div className="ml-1 transition group-hover:translate-x-1"><svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5"><path d="M8.14645 3.14645C8.34171 2.95118 8.65829 2.95118 8.85355 3.14645L12.8536 7.14645C13.0488 7.34171 13.0488 7.65829 12.8536 7.85355L8.85355 11.8536C8.65829 12.0488 8.34171 12.0488 8.14645 11.8536C7.95118 11.6583 7.95118 11.3417 8.14645 11.1464L11.2929 8H2.5C2.22386 8 2 7.77614 2 7.5C2 7.22386 2.22386 7 2.5 7H11.2929L8.14645 3.85355C7.95118 3.65829 7.95118 3.34171 8.14645 3.14645Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg></div></button>
                        </div>
                      </>
                    }
                  </>
                }
              </div>

            </>

          }

        </div>
        {mode !== 'create' &&
          <section className="bg-white mt-4">
            <div className="container px-6 py-12 mx-auto">
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <h1 className="mt-4 text-xl font-semibold text-gray-800 ">{locale.Home_Landing001Title}</h1>

                  <p className="mt-2 text-gray-500 ">{locale.Home_Landing001Descrtption}</p>

                  <div className="flex justify-center mt-4 border  rounded-lg">
                    <img
                      src="https://backet.skyblur.uk/001.png"
                      alt="Skyblur post image"
                      width={338}
                      height={150}
                    />
                  </div>

                </div>


                <div>
                  <h1 className="mt-4 text-xl font-semibold text-gray-800 ">{locale.Home_Landing002Title}</h1>

                  <p className="mt-2 text-gray-500 ">{locale.Home_Landing002Descrtption}</p>

                  <div className="flex justify-center mt-4 border rounded-lg">
                    <img
                      src="https://backet.skyblur.uk/002.png"
                      alt="Bluesky post image"
                      width={382}
                      height={150}
                    />
                  </div>
                </div>


                <div>
                  <h1 className="mt-4 text-xl font-semibold text-gray-800 ">{locale.Home_Landing003Title}</h1>

                  <p className="mt-2 text-gray-500 ">{locale.Home_Landing003Descrtption}</p>
                  <div className="flex justify-center mt-4 border">
                    <img
                      src="https://backet.skyblur.uk/003.png"
                      alt="Skyblur Viewer"
                      width={310}
                      height={150}
                    />
                  </div>
                </div>

              </div>
            </div>
          </section>
        }

      </main>

    </div>
  );
}
