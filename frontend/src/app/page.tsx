"use client";
import { CreatePostForm } from "@/components/CreatePost";
import Loading from "@/components/Loading";
import { AuthenticationTitle } from "@/components/login/Login";
import { PostList } from "@/components/PostList";
import { useLocaleStore } from "@/state/Locale";
import { useModeStore } from "@/state/Mode";
import { useXrpcAgentStore } from "@/state/XrpcAgent";
import { PostListItem } from "@/types/types";
import { Affix, Button } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { useEffect, useState } from "react";
import { IoCreateOutline } from "react-icons/io5";
import { MdArrowBack } from "react-icons/md";
import { Loader } from '@mantine/core';

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
  }, []);

  if (!isMounted) {
    return (
      <Loading />
    );
  }

  return (

    <div >


      <main className=" ">

        <div className="mx-auto max-w-screen-md ">

          {did === "" &&
            <><div className="flex items-center justify-center h-full mt-4 mx-4">
              {locale.Home_Welcome}
            </div>

              <div className="row-start-3 flex gap-6 flex-wrap items-center justify-center mt-2">
                {isLoginProcess ?
                  <div className="flex flex-col items-center justify-center h-full">
                    <p className="mb-2"><Loader color="blue" /></p>
                    {locale.Home_inAuthProgress}
                  </div>
                  :
                  <AuthenticationTitle />
                }
              </div>

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
                          {locale.Menu_LoginMessage.replace("{1}", userProf?.displayName || 'No Name')}
                        </div>

                        <div className="flex justify-center gap-4 mb-8">
                          <Button leftSection={<IoCreateOutline size={14} />} variant="filled" onClick={() => handleNew()}>{locale.Menu_CreatePost}</Button>
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
                        <Affix
                          position={{ bottom: 60, left: '50%' }}
                          style={{ transform: 'translateX(-50%)' }}
                        >
                          <Button
                            variant="default"
                            color="gray"
                            leftSection={<MdArrowBack />}
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
