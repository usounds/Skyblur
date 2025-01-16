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
import URLCopyButton from "@/components/URLCopyButton";
import { BlobRef } from '@atproto/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Home() {
  const agent = useAtpAgentStore((state) => state.agent);
  const userProf = useAtpAgentStore((state) => state.userProf);
  const did = useAtpAgentStore((state) => state.did);
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isUseMyPage, setIsUseMyPage] = useState<boolean>(false)
  const [myPageDescription, setMyPageDescription] = useState<string>('')
  const [isCustomFeed, setIsCustomFeed] = useState<boolean>(false)
  const [isSave, setIsSave] = useState<boolean>(false)
  const locale = useLocaleStore((state) => state.localeData);
  const [feedName, setFeedName] = useState<string>(locale.Pref_CustomFeedDefaltName?.replace('{1}', agent?.assertDid || '') || '')
  const [feedDescription, setFeedDescription] = useState<string>('')
  const [feedUpdateMessage, setFeedUpdateMessage] = useState<string>('')
  const [feedUpdateCompleted, setFeedUpdateCompleted] = useState<boolean>(false)
  const [feedAvatarImg, setFeedAvatarImg] = useState('')
  const [feedAvatar, setFeedAvatar] = useState<File>()
  const router = useRouter();

  useEffect(() => {
    if (!agent || !did) {
      router.push('/')
      return
    }
    setIsLoading(true)
    const fetchData = async () => {
      try {

        const value = await getPreference(agent, did)
        if (value.myPage.isUseMyPage) setIsUseMyPage(true)
        setMyPageDescription(value.myPage.description)

      } catch (e) {
        console.error(e)
      }

      try {

        const feedATUri = 'at://' + did + '/app.bsky.feed.generator/skyblurCustomFeed'
        const result = await agent.app.bsky.feed.getFeedGenerator({ feed: feedATUri })
        setFeedName(result.data.view.displayName)
        setFeedDescription(result.data.view.description || '')
        setFeedAvatarImg(result.data.view.avatar || '')
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


  const changeFeedAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const imgObject = e.target.files[0];
    setFeedAvatar(imgObject)
    if (imgObject) {
      setFeedAvatarImg(window.URL.createObjectURL(imgObject))
    } else {
      setFeedAvatarImg('')

    }

  };

  const handleIsUseMyPage = async (param: boolean) => {
    if (!agent || !did) return
    setIsSave(true)

    try {
      await agent.com.atproto.repo.putRecord({
        repo: did,
        collection: 'uk.skyblur.preference',
        rkey: 'self',
        record: {
          myPage: {
            isUseMyPage: param,
            description: myPageDescription
          }

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


    let avatarRef: BlobRef | undefined
    let encoding: string = ''

    if (feedAvatar?.name.endsWith('png')) {
      encoding = 'image/png'
    } else if (feedAvatar?.name.endsWith('jpg') || feedAvatar?.name.endsWith('jpeg')) {
      encoding = 'image/jpeg'
    } else if (feedAvatar !== undefined) {
      setFeedUpdateMessage(locale.Pref_FileType)
      setIsLoading(false)
      return
    }

    try {

      if (feedAvatar) {
        const fileUint = new Uint8Array(await feedAvatar.arrayBuffer())

        const blobRes = await agent.uploadBlob(fileUint, {
          encoding,
        })
        avatarRef = blobRes.data.blob


      } else if (feedAvatarImg) {
        let parts = feedAvatarImg.split('/')
        parts = parts[7].split('@')

        const ret = await agent.com.atproto.sync.getBlob({
          did: agent.assertDid,
          cid: parts[0]
        })

        if (parts[1].endsWith('png')) {
          encoding = 'image/png'
        } else if (parts[1].endsWith('jpg') || parts[1].endsWith('jpeg')) {
          encoding = 'image/jpeg'
        }

        const fileUint = new Uint8Array(await ret.data.buffer)

        const blobRes = await agent.uploadBlob(fileUint, {
          encoding,
        })
        avatarRef = blobRes.data.blob

      }

      await agent.com.atproto.repo.putRecord({
        repo: did,
        collection: 'app.bsky.feed.generator',
        rkey: 'skyblurCustomFeed',
        record: {
          did: 'did:web:feed.skyblur.uk',
          displayName: feedName,
          description: feedDescription,
          createdAt: new Date().toISOString(),
          avatar: avatarRef,
        }
      });
    } catch (e) {
      setFeedUpdateMessage('Error:' + e)
      setIsSave(false)
      return
    }

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
    setFeedUpdateMessage("")
    setFeedUpdateCompleted(false)
    setIsSave(true)
    try {
      await handleCustomFeed(isCustomFeed)
      await handleIsUseMyPage(isUseMyPage)
      setFeedUpdateCompleted(true)
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
                          <div className="block text-sm text-gray-400 mt-1">{locale.Pref_MyPagePublishDescription}</div>
                          <div className="flex items-center mt-2 space-x-2">
                            <Toggle
                              checked={isUseMyPage}
                              onChange={setIsUseMyPage} // Boolean を渡します
                              disabled={isSave}
                            />
                            <span>{locale.Pref_MyPagePublish}</span>
                          </div>
                          {isUseMyPage && (
                            <>
                              <div className="block text-m text-gray-600 mt-1">{locale.Pref_MyPageDesc}</div>
                              <Textarea value={myPageDescription} onChange={(e) => setMyPageDescription(e.target.value)} maxLength={1000} />
                              <div className="flex flex-col items-center mt-1 ">
                                <URLCopyButton url={`https://${window.location.hostname}/profile/${did}`} />
                              </div>
                            </>
                          )}
                        </>
                        <>
                          <div className="mt-6">{locale.Pref_CustomFeed}</div>
                          <div className="block text-sm text-gray-400 mt-1">{locale.Pref_CustomFeedPublishDescription}</div>
                          <div className="flex items-center mt-2 space-x-2">
                            <Toggle
                              checked={isCustomFeed}
                              onChange={setIsCustomFeed} // Boolean を渡します
                              disabled={isSave}
                            />
                            <span>{locale.Pref_CustomFeedPublish}</span>
                          </div>
                          {isCustomFeed && (
                            <>

                              <div className="block text-m text-gray-600 mt-1">{locale.Pref_CustomFeedName}</div>
                              <Input value={feedName} onChange={(e) => setFeedName(e.target.value)} maxLength={24} />
                              <div className="block text-m text-gray-600 mt-1">{locale.Pref_CustomFeedDescription}</div>
                              <Textarea value={feedDescription} onChange={(e) => setFeedDescription(e.target.value)} maxLength={200} />
                              <div className="block text-m text-gray-600 mt-1">{locale.Pref_CustomFeedAvatar}</div>
                              {feedAvatarImg &&
                                <p>
                                  <img src={feedAvatarImg} width='100px' />
                                </p>
                              }
                              <input type="file" accept=".png, .jpg, .jpeg" className="mb-2 w-[300px] inline-block text-sm text-gray-800 sm:text-base" onChange={changeFeedAvatar} />
                              <div className="block text-sm text-gray-600 mt-1">
                                <div className="flex flex-col items-center ">
                                  <URLCopyButton url={`https://bsky.app/profile/${did}/feed/skyblurCustomFeed`} />
                                </div>
                              </div>
                            </>
                          )}

                          <div className="flex flex-col items-center gap-2 mt-6">
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
                            {feedUpdateCompleted && !feedUpdateMessage && <div className="text-blue-500 mb-1">{locale.Pref_SaveCompleted}</div>}
                          </div>
                        </>
                      </>
                    }
                  </div>
                  <div className="flex flex-col items-center gap-4 mt-6">
                    <Link href="/">
                      <Button
                        color="secondary"
                        size="large"
                        className="text-white text-base font-normal"
                      >
                        {locale.Menu_Back}
                      </Button>
                    </Link>
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
