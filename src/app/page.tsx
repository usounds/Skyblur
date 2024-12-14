"use client";
export const runtime = 'edge';
import { CreatePostForm } from "@/components/CreatePost";
import Header from "@/components/Header";
import { LoginForm } from "@/components/LoginForm";
import { DeleteList } from "@/components/PostList";
import { useAtpAgentStore } from "@/state/AtpAgent";
import { useLocaleStore } from "@/state/Locale";
import { useModeStore } from "@/state/Mode";
import { PostListItem } from "@/types/types";
import Image from 'next/image';
import { useState } from "react";

export default function Home() {
  const [prevBlur, setPrevBlur] = useState<PostListItem>()
  const did = useAtpAgentStore((state) => state.did);
  const locale = useLocaleStore((state) => state.localeData);
  const isLoading = useAtpAgentStore((state) => state.isLoginProcess);
  const userProf = useAtpAgentStore((state) => state.userProf);
  const blueskyLoginMessage = useAtpAgentStore((state) => state.blueskyLoginMessage);
  const mode = useModeStore((state) => state.mode);
  const setMode = useModeStore((state) => state.setMode);

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

      <Header />

      <main className="text-gray-800 ">

        <div className="mx-auto max-w-screen-md ">

          {did === "" &&
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
                  <LoginForm />

                }</>
              </div>

              <div className="row-start-3 flex gap-6 flex-wrap items-center justify-center mt-2">


                {blueskyLoginMessage && <p>{blueskyLoginMessage}</p>
                }
              </div>
            </>
          }

          {did &&

            <>

              <div className="w-full">
                {userProf &&
                  <>
                    {mode === 'menu' &&
                      <>
                        <div className="mx-auto max-w-screen-sm flex flex-col  ">
                          <div className="flex justify-center my-4">
                            {locale.Menu_LoginMessage.replace("{1}", userProf.displayName || 'No Name')}
                          </div>

                          <div className="flex justify-center gap-4 mb-8">
                            <button onClick={() => handleNew()} className="relative z-0 h-12 rounded-full bg-blue-500 px-6 text-neutral-50 after:absolute after:left-0 after:top-0 after:-z-10 after:h-full after:w-full after:rounded-full after:bg-blue-500 hover:after:scale-x-125 hover:after:scale-y-150 hover:after:opacity-0 hover:after:transition hover:after:duration-500">

                              <>
                                {locale.Menu_CreatePost}
                              </>
                            </button>

                          </div>

                          <DeleteList handleEdit={handleEdit} />

                        </div>
                      </>
                    }
                    {mode === 'create' &&
                      <>
                        <CreatePostForm setMode={setMode} prevBlur={prevBlur}
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
                    <Image
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
                    <Image
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
                    <Image
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
