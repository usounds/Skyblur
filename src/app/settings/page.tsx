"use client"
export const runtime = 'edge';
import Header from "@/components/Header";
import { getPreference } from "@/logic/HandleBluesky";
import { useAtpAgentStore } from "@/state/AtpAgent";
import { useLocaleStore } from "@/state/Locale";
import { customTheme } from "@/types/types";
import { Button, Notifications, NotificationsContext, ThemeProvider, Toggle, extendTheme, theme, Input, Textarea } from 'reablocks';
import { useEffect, useState } from "react";
import BeatLoader from "react-spinners/BeatLoader";

export default function Home() {
  const agent = useAtpAgentStore((state) => state.agent);
  const userProf = useAtpAgentStore((state) => state.userProf);
  const did = useAtpAgentStore((state) => state.did);
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isUseMyPage, setIsUseMyPage] = useState<boolean>(false)
  const [isCustomFeed, setIsCustomFeed] = useState<boolean>(false)
  const [isSave, setIsSave] = useState<boolean>(false)
  const locale = useLocaleStore((state) => state.localeData);
  const [feedName, setFeedName] = useState<string>(locale.Pref_CustomFeedDefaltName?.replace('{1}', agent?.assertDid || '') || '')
  const [feedDescription, setFeedDescription] = useState<string>('')
  const [feedUpdateMessage, setFeedUpdateMessage] = useState<string>('')

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

      try {

        const ret = await agent.com.atproto.repo.getRecord({
          repo: did,
          collection: 'app.bsky.feed.generator',
          rkey: 'skyblurCustomFeed'
        });

        const recordValue = ret.data.value as { displayName: string, description: string };
        setFeedName(recordValue.displayName)
        setFeedDescription(recordValue.description)
        setIsCustomFeed(true)

      } catch (e) {
        setFeedName(locale.Pref_CustomFeedDefaltName?.replace('{1}', userProf?.displayName || '').slice(0, 24) || '')
        setFeedDescription('')

      }

      setIsLoading(false)

    };

    fetchData();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [did]);

  const handleIsUseMyPage = async (param: boolean) => {
    console.log('handleIsUseMyPage')
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


  const submitFeedRecord = async () => {
    if (!agent || !did) return
    await agent.com.atproto.repo.putRecord({
      repo: did,
      collection: 'app.bsky.feed.generator',
      rkey: 'skyblurCustomFeed',
      record: {
        did: 'did:web:feed.skyblur.uk',
        displayName: feedName,
        description: feedDescription,
        createdAt: new Date().toISOString(),
      }
    });
  }

  const handleCustomFeed = async (param: boolean) => {
    if (!agent || !did) return

    try {
      if (param) {
        await submitFeedRecord();
      } else {
        await agent.com.atproto.repo.deleteRecord({
          repo: did,
          collection: 'app.bsky.feed.generator',
          rkey: 'skyblurCustomFeed'
        });

      }

    } catch (e) {
      console.error(e)
    }

  }


  const handleSave = async () => {
    if (!agent || !did) return
    setIsSave(true)
    try {
      await handleCustomFeed(isCustomFeed)
      await handleIsUseMyPage(isUseMyPage)
    } catch (e) {
      setFeedUpdateMessage('Error:' + e)
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
                        <>
                          <span>{locale.Pref_MyPage}</span>
                          <div className="flex items-center mt-2 space-x-2">
                            <Toggle
                              checked={isUseMyPage}
                              onChange={setIsUseMyPage} // Boolean を渡します
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
                        <>
                          <div className="mt-4">{locale.Pref_CustomFeed}</div>
                          <div className="flex items-center mt-2 space-x-2">
                            <Toggle
                              checked={isCustomFeed}
                              onChange={setIsCustomFeed} // Boolean を渡します
                              disabled={isSave}
                            />
                            <span>{locale.Pref_CustomFeedPublish}</span>
                          </div>
                          <div className="block text-sm text-gray-400 mt-1">{locale.Pref_CustomFeedPublishDescription}</div>
                          {isCustomFeed && (
                            <>
                              <div className="block text-sm text-gray-400 mt-1">
                                <a
                                  target="_blank"
                                  href={`https://bsky.app/profile/${did}/feed/skyblurCustomFeed`}
                                  onClick={(e) => {
                                    e.preventDefault(); // デフォルトのリンク動作を防ぐ
                                    navigator.clipboard.writeText(`https://bsky.app/profile/${did}/feed/skyblurCustomFeed`).then(() => {
                                      // コピーが成功した場合の処理
                                      alert(locale.DeleteList_URLCopy);
                                    }).catch((err) => {
                                      // コピー失敗時の処理
                                      console.error('コピーに失敗しました: ', err);
                                    });
                                  }}
                                >
                                  https://bsky.app/profile/{did}/feed/skyblurCustomFeed
                                </a>
                              </div>

                              <div className="block text-m text-gray-600 mt-1">{locale.Pref_CustomFeedName}</div>
                              <Input value={feedName} onChange={(e) => setFeedName(e.target.value)} maxLength={24} />
                              <div className="block text-m text-gray-600 mt-1">{locale.Pref_CustomFeedDescription}</div>
                              <Textarea value={feedDescription} onChange={(e) => setFeedDescription(e.target.value)} maxLength={200} />

                            </>
                          )}

                          <div className="flex flex-col items-center gap-4 mt-6">
                            <Button
                              color="primary"
                              size="large"
                              className="text-white text-base font-normal"
                              onClick={handleSave}
                              disabled={isSave}
                            >
                              {locale.Pref_CustomFeedButton}
                            </Button>
                            <div className="text-red-500 mb-1">{feedUpdateMessage}</div>
                          </div>
                        </>
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
