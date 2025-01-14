"use client"
export const runtime = 'edge';
import Header from "@/components/Header";
import { getPreference } from "@/logic/HandleBluesky";
import { useAtpAgentStore } from "@/state/AtpAgent";
import { useLocaleStore } from "@/state/Locale";
import { customTheme } from "@/types/types";
import { Button, Notifications, NotificationsContext, ThemeProvider, Toggle, extendTheme, theme, useNotification } from 'reablocks';
import { useEffect, useState } from "react";
import BeatLoader from "react-spinners/BeatLoader";

export default function Home() {
  const agent = useAtpAgentStore((state) => state.agent);
  const did = useAtpAgentStore((state) => state.did);
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isUseMyPage, setIsUseMyPage] = useState<boolean>(false)
  const [isSave, setIsSave] = useState<boolean>(false)
  const locale = useLocaleStore((state) => state.localeData);

  useEffect(() => {
    if (!agent || !did) return
    setIsLoading(true)
    const fetchData = async () => {
      try {

        const value = await getPreference(agent, did)

        if (value.isUseMyPage) setIsUseMyPage(true)

      } catch (e) {
        console.error(e)
      }

      setIsLoading(false)

    };

    fetchData();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [did]);

  const handleIsUseMyPage = async (param: boolean) => {
    if (!agent || !did) return
    setIsSave(true)

    try {
      await agent.com.atproto.repo.putRecord({
        repo: did,
        collection: 'uk.skyblur.preference',
        rkey: 'self',
        record: {
          isUseMyPage: param
        }
      });

      setIsUseMyPage(param)
    } catch (e) {
      console.error(e)
    }
    setIsSave(false)

  }

  return (
    < >
      <Header />
      <ThemeProvider theme={extendTheme(theme, customTheme)}>
        <main className="text-gray-700 ">
          <Notifications>
            <NotificationsContext.Consumer>
              {() => (
                <>
                  <div className="flex items-center justify-center h-full text-gray-800 mt-4 mx-4">
                    {locale.Pref_Title}
                  </div>
                  {isLoading &&
                    <div className="flex flex-col items-center gap-4 mb-8 mt-2"><BeatLoader /></div>
                  }
                  <div className="mx-auto max-w-screen-md px-4">
                    {!isLoading &&
                      <>
                          <span>{locale.Pref_MyPage}</span>
                        <div className="flex items-center space-x-2">
                          <Toggle
                            checked={isUseMyPage}
                            onChange={handleIsUseMyPage} // Boolean を渡します
                            disabled={isSave}
                          />
                          <span>{locale.Pref_MyPagePublish}</span>
                        </div>
                        <div className="block text-sm text-gray-400 mt-1">{locale.Pref_MyPagePublishDescription}</div>
                        {isUseMyPage && (
                          <div className="block text-sm text-gray-400 mt-1">
                            <a
                              target="_blank"
                              href={`https://skyblur.uk/profile/${did}`}
                              onClick={(e) => {
                                e.preventDefault(); // デフォルトのリンク動作を防ぐ
                                navigator.clipboard.writeText(`https://skyblur.uk/profile/${did}`).then(() => {
                                  // コピーが成功した場合の処理
                                  alert(locale.DeleteList_URLCopy);
                                }).catch((err) => {
                                  // コピー失敗時の処理
                                  console.error('コピーに失敗しました: ', err);
                                });
                              }}
                            >
                              https://skyblur.uk/profile/{did}
                            </a>
                          </div>
                        )}
                      </>
                    }
                  </div>
                  <div className="flex flex-col items-center gap-4 mt-6">
                    <Button
                      color="secondary"
                      size="large"
                      className="text-white text-base font-normal"
                      onClick={() => window.history.back()} // ブラウザバックを実行
                    >
                      {locale.Menu_Back}
                    </Button>
                  </div>
                </>
              )}
            </NotificationsContext.Consumer>
          </Notifications>

        </main>
      </ThemeProvider>
    </ >
  );
}
