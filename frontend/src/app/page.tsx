"use client";
import { CreatePostForm } from "@/components/CreatePost";
import Loading from "@/components/Loading";
import { AuthenticationTitle } from "@/components/login/Login";
import { PostList } from "@/components/PostList";
import { RecommendedClients } from "@/components/RecommendedClients";
import { useLocaleStore } from "@/state/Locale";
import { useModeStore } from "@/state/Mode";
import { useXrpcAgentStore } from "@/state/XrpcAgent";
import { PostListItem } from "@/types/types";
import { Affix, Button } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { useEffect, useState } from "react";
import { Pencil } from 'lucide-react';
import { ArrowLeft } from 'lucide-react';

export default function Home() {
  const [prevBlur, setPrevBlur] = useState<PostListItem>()
  const [isMounted, setIsMounted] = useState(false);
  const did = useXrpcAgentStore((state) => state.did);
  const agent = useXrpcAgentStore((state) => state.agent);
  const locale = useLocaleStore((state) => state.localeData);
  const userProf = useXrpcAgentStore((state) => state.userProf);
  const blueskyLoginMessage = useXrpcAgentStore((state) => state.blueskyLoginMessage);
  const mode = useModeStore((state) => state.mode);
  const setMode = useModeStore((state) => state.setMode);
  const isLoginProcess = useXrpcAgentStore((state) => state.isLoginProcess);
  const serviceUrl = useXrpcAgentStore((state) => state.serviceUrl);
  const isMobile = useMediaQuery('(max-width: 768px)');

  const handleEdit = (input: PostListItem) => {
    setPrevBlur(input)
    setMode("create")

  };

  const handleNew = () => {
    setPrevBlur(undefined)
    setMode("create")

  };

  useEffect(() => {
    setIsMounted(true);

    // callbackからのリダイレクト時、認証処理中フラグがあればローディングを表示
    const authPending = window.localStorage.getItem('oauth.authPending');
    if (authPending === 'true') {
      window.localStorage.removeItem('oauth.authPending');
    }
  }, []);

  if (!isMounted) {
    return (
      <div>
        <main>
          <div className="mx-auto max-w-screen-md">
            <div className={`flex items-center justify-center h-full mt-4 mx-4 invisible`}>
              Skyblurへようこそ。Blueskyへ伏せ字を使った文章をポストできます。
            </div>
            <div className="row-start-3 flex gap-6 flex-wrap items-center justify-center mt-2">
              <Loading />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (

    <div >


      <main className=" ">

        <div className="mx-auto max-w-screen-md ">


          {did === "" &&
            <>
              {(() => {
                const isRestoring = isLoginProcess || (typeof window !== 'undefined' && (window.localStorage.getItem('oauth.did') || window.localStorage.getItem('oauth.authPending') === 'true'));
                return (
                  <>
                    <div className={`flex items-center justify-center h-full mt-4 mx-4 ${isRestoring ? 'invisible' : ''}`}>
                      {locale.Home_Welcome}
                    </div>

                    <div className="row-start-3 flex gap-6 flex-wrap items-center justify-center mt-2">
                      {isRestoring ?
                        <Loading />
                        :
                        <AuthenticationTitle />
                      }
                    </div>
                  </>
                );
              })()}





              <RecommendedClients />

            </>
          }
          {blueskyLoginMessage &&
            <div className="row-start-3 flex gap-6 flex-wrap items-center justify-center mt-2 text-red-500">
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
                          {locale.Menu_LoginMessage.replace("{2}", (new Date().getHours() < 5 || new Date().getHours() >= 18) ? locale.Greeting_Night : (new Date().getHours() < 11) ? locale.Greeting_Morning : locale.Greeting_Day).replace("{1}", userProf?.displayName || 'No Name')}
                        </div>

                        <div className="flex justify-center gap-4 mb-8">
                          <Button leftSection={<Pencil size={14} />} variant="filled" onClick={() => handleNew()}>{locale.Menu_CreatePost}</Button>
                        </div>

                        {(agent && serviceUrl) &&

                          <PostList handleEdit={handleEdit} agent={agent} did={did} pds={serviceUrl} />
                        }

                      </div>
                    </>
                  }
                  {mode === 'create' &&
                    <>
                      <CreatePostForm setMode={setMode} prevBlur={prevBlur} />

                      <div className="flex justify-center mt-4"></div>

                      <div className="flex justify-center mt-4">
                        <Affix position={{ bottom: 60, left: isMobile ? 20 : '20%' }}>
                          <Button
                            variant="default"
                            color="gray"
                            leftSection={<ArrowLeft />}
                            onClick={() => {
                              setMode("menu");
                            }} >
                            {locale.Menu_Back}
                          </Button>
                        </Affix>
                      </div>
                    </>
                  }
                </>
              </div>

            </>

          }

        </div>
        {(mode == 'login' && !isLoginProcess) &&
          <section className="mt-4">
            <div className="container px-6 py-12 mx-auto">
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">


              </div>
            </div>
          </section>
        }

      </main>

    </div>
  );
}
