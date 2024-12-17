"use client";
export const runtime = 'edge';
import { CreatePostForm } from "@/components/CreatePost";
import Header from "@/components/Header";
import { LoginForm } from "@/components/LoginForm";
import { PostList } from "@/components/PostList";
import { useAtpAgentStore } from "@/state/AtpAgent";
import { useLocaleStore } from "@/state/Locale";
import { useModeStore } from "@/state/Mode";
import { PostListItem, customTheme } from "@/types/types";
import Image from 'next/image';
import { Button, ThemeProvider, extendTheme, theme, DotsLoader, Notifications, NotificationsContext } from 'reablocks';
import { useState } from "react";


export default function Home() {
  const [prevBlur, setPrevBlur] = useState<PostListItem>()
  const did = useAtpAgentStore((state) => state.did);
  const locale = useLocaleStore((state) => state.localeData);
  const userProf = useAtpAgentStore((state) => state.userProf);
  const blueskyLoginMessage = useAtpAgentStore((state) => state.blueskyLoginMessage);
  const mode = useModeStore((state) => state.mode);
  const setMode = useModeStore((state) => state.setMode);
  const isLoginProcess = useAtpAgentStore((state) => state.isLoginProcess);

  const handleEdit = (input: PostListItem) => {
    setPrevBlur(input)
    setMode("create")

  };

  const handleNew = () => {
    setPrevBlur(undefined)
    setMode("create")

  };



  return (

    <div className="">

      <ThemeProvider theme={extendTheme(theme, customTheme)}>


        <Header />
        <main className="text-gray-700 ">

          <Notifications>
            <NotificationsContext.Consumer>
              {({
                notifySuccess,
                notifyError
              }) => <>

                  <div className="mx-auto max-w-screen-md ">

                    {did === "" &&
                      <><div className="flex items-center justify-center h-full text-gray-800 mt-4 mx-4">
                        {locale.Home_Welcome}
                      </div>

                        <div className="row-start-3 flex gap-6 flex-wrap items-center justify-center mt-2">
                          {isLoginProcess ?
                            <div className="flex flex-col items-center justify-center h-full">
                              <p className="mb-2"><DotsLoader /></p>
                              {locale.Home_inAuthProgress}
                            </div>
                            :
                            <LoginForm />
                          }
                        </div>

                      </>
                    }
                    {blueskyLoginMessage &&
                      <div className="row-start-3 flex gap-6 flex-wrap items-center justify-center mt-2">
                        <p className="mt-2">{blueskyLoginMessage}</p>
                      </div>
                    }

                    {did &&

                      <>

                        <div className="w-full">
                          <>
                            {mode === 'menu' &&
                              <>
                                <div className="mx-auto max-w-screen-sm flex flex-col  ">
                                  <div className="flex justify-center my-4">
                                    {locale.Menu_LoginMessage.replace("{1}", userProf?.displayName || 'No Name')}
                                  </div>

                                  <div className="flex justify-center gap-4 mb-8">

                                    <Button color="primary" size="large" className="text-white text-base font-normal" onClick={() => handleNew()}>
                                      {locale.Menu_CreatePost}
                                    </Button>

                                  </div>

                                  <PostList handleEdit={handleEdit} notifySuccess={notifySuccess} notifyError={notifyError}/>

                                </div>
                              </>
                            }
                            {mode === 'create' &&
                              <>
                                <CreatePostForm setMode={setMode} prevBlur={prevBlur} notifySuccess={notifySuccess} notifyError={notifyError}/>

                                <div className="flex justify-center mt-4"></div>

                                <div className="flex justify-center mt-4">

                                  <Button color="secondary" size="large" className="text-white text-base font-normal" onClick={() => {
                                    setMode("menu");
                                    window.scrollTo(0, 0); // ページを一番上までスクロール
                                  }} >
                                    {locale.Menu_Back}
                                  </Button>
                                </div>
                              </>
                            }
                          </>
                        </div>

                      </>

                    }

                  </div>
                  {(mode == 'login' && !isLoginProcess) &&
                    <section className="bg-white mt-4">
                      <div className="container px-6 py-12 mx-auto">
                        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                          <div>
                            <h1 className="mt-4 text-xl font-semibold text-gray-800 ">{locale.Home_Landing001Title}</h1>

                            <p className="mt-2 text-gray-500 ">{locale.Home_Landing001Descrtption}</p>

                            <div className="flex justify-center mt-4 border  rounded-lg">
                              <Image
                                src="https://backet.skyblur.uk/001.png"
                                alt="Skyblur post image"
                                width={338}
                                height={150}
                                unoptimized
                              />
                            </div>

                          </div>


                          <div>
                            <h1 className="mt-4 text-xl font-semibold text-gray-800 ">{locale.Home_Landing002Title}</h1>

                            <p className="mt-2 text-gray-500 ">{locale.Home_Landing002Descrtption}</p>

                            <div className="flex justify-center mt-4 border rounded-lg">
                              <Image
                                src="https://backet.skyblur.uk/002.png"
                                alt="Bluesky post image"
                                width={382}
                                height={150}
                                unoptimized
                              />
                            </div>
                          </div>


                          <div>
                            <h1 className="mt-4 text-xl font-semibold text-gray-800 ">{locale.Home_Landing003Title}</h1>

                            <p className="mt-2 text-gray-500 ">{locale.Home_Landing003Descrtption}</p>
                            <div className="flex justify-center mt-4 border">
                              <Image
                                src="https://backet.skyblur.uk/003.png"
                                alt="Skyblur Viewer"
                                width={310}
                                height={150}
                                unoptimized
                              />
                            </div>
                          </div>

                        </div>
                      </div>
                    </section>
                  }
                </>}
            </NotificationsContext.Consumer>
          </Notifications>
        </main>
      </ThemeProvider>

    </div>
  );
}
