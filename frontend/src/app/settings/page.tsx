"use client"
import Loading from "@/components/Loading";
import URLCopyButton from "@/components/URLCopyButton";
import { getPreference } from "@/logic/HandleBluesky";
import { useLocaleStore } from "@/state/Locale";
import { useXrpcAgentStore } from "@/state/XrpcAgent";
import { ActorIdentifier, ResourceUri } from '@atcute/lexicons/syntax';
import { Button, LoadingOverlay, Switch, Textarea, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import Image from "next/image";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from "react";
import { HiCheck } from "react-icons/hi";
import { MdArrowBack } from "react-icons/md";

export default function Home() {
  const agent = useXrpcAgentStore((state) => state.agent);
  const userProf = useXrpcAgentStore((state) => state.userProf);
  const did = useXrpcAgentStore((state) => state.did);
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isUseMyPage, setIsUseMyPage] = useState<boolean>(false)
  const [preferenceMode, setPreferenceMode] = useState<"create" | "update">('create')
  const [myPageDescription, setMyPageDescription] = useState<string>('')
  const [isCustomFeed, setIsCustomFeed] = useState<boolean>(false)
  const [isSave, setIsSave] = useState<boolean>(false)
  const locale = useLocaleStore((state) => state.localeData);
  const [feedName, setFeedName] = useState<string>(locale.Pref_CustomFeedDefaltName?.replace('{1}', did || '') || '')
  const [feedDescription, setFeedDescription] = useState<string>('')
  const [feedUpdateMessage, setFeedUpdateMessage] = useState<string>('')
  const [feedAvatarImg, setFeedAvatarImg] = useState('')
  const [feedAvatar, setFeedAvatar] = useState<File>()
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    if (!agent || !did) {
      router.push('/')
      return
    }
    setIsMounted(true);
    setIsLoading(true)
    const fetchData = async () => {
      try {

        const value = await getPreference(agent, did)
        if (value === null) {
          setPreferenceMode('create')
          setIsLoading(false)
          return
        }
        setPreferenceMode('update')
        if (value.myPage.isUseMyPage) setIsUseMyPage(true)
        setMyPageDescription(value.myPage.description || '')

      } catch (e) {
        console.error(e)
      }

      const feedATUri = 'at://' + did + '/app.bsky.feed.generator/skyblurCustomFeed'
      const result = await agent.get('app.bsky.feed.getFeedGenerator', {
        params: {
          feed: feedATUri as ResourceUri,
        },
      });

      if (!result.ok) {
        setFeedName(locale.Pref_CustomFeedDefaltName?.replace('{1}', userProf?.displayName || '').slice(0, 24) || '')
        setFeedDescription('')
      } else {
        setFeedName(result.data.view.displayName)
        setFeedDescription(result.data.view.description || '')
        setFeedAvatarImg(result.data.view.avatar || '')
        setIsCustomFeed(true)

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
      const writes = [
        {
          $type: `com.atproto.repo.applyWrites#${preferenceMode}` as const,
          collection: 'uk.skyblur.preference' as `${string}.${string}.${string}`,
          rkey: 'self',
          value: {
            myPage: {
              isUseMyPage: param,
              description: myPageDescription,
            },
          },
        },
      ];

      await agent.post('com.atproto.repo.applyWrites', {
        input: {
          repo: did as ActorIdentifier,
          writes: writes,
        },
      });
      setIsUseMyPage(param)


    } catch (e) {
      console.error(e)
    }
    setIsSave(false)

  }


  const submitFeedRecord = async () => {
    if (!agent || !did) return
    let avatarRef: Blob | null = null;

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
        const fileUint = new Uint8Array(await feedAvatar.arrayBuffer());

        const blobRes = await agent.post('com.atproto.repo.uploadBlob', {
          input: fileUint,
          encoding,
          headers: { 'Content-Type': 'application/octet-stream' },
        });

        if (!blobRes.ok) {
          setFeedUpdateMessage('error');
          return
        }

        avatarRef = blobRes.data.blob as unknown as Blob;

      } else if (feedAvatarImg) {
        // feedAvatarImgからCIDと拡張子を取得
        let parts = feedAvatarImg.split('/');
        parts = parts[7].split('@');

        const didValue = did as `did:${string}:${string}`;

        // BlobをGET
        const ret = await agent.get('com.atproto.sync.getBlob', {
          params: {
            did: didValue,
            cid: parts[0],
          },
          as: 'blob',
        });

        if (!ret.ok) {
          throw new Error('Failed to get blob');
        }

        const fileUint = new Uint8Array(await ret.data.arrayBuffer());

        const blobRes = await agent.post('com.atproto.repo.uploadBlob', {
          input: fileUint,
          encoding,
          headers: { 'Content-Type': 'application/octet-stream' },
        });

        if (!blobRes.ok) {
          setFeedUpdateMessage('error');
          return
        }

        avatarRef = blobRes.data.blob as unknown as Blob;
      }

      const record = {
        did: 'did:web:feed.skyblur.uk',
        displayName: feedName,
        description: feedDescription,
        createdAt: new Date().toISOString(),
        ...(avatarRef ? { avatar: avatarRef } : {}),
      };

      await agent.post('com.atproto.repo.putRecord', {
        input: {
          repo: did as ActorIdentifier,
          collection: 'app.bsky.feed.generator' as `${string}.${string}.${string}`,
          rkey: 'skyblurCustomFeed',
          record,
        },
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
        const writes: {
          $type: 'com.atproto.repo.applyWrites#delete';
          collection: 'app.bsky.feed.generator';  // 削除対象のコレクション名に変更
          rkey: string;
        }[] = [];

        writes.push({
          $type: 'com.atproto.repo.applyWrites#delete',
          collection: 'app.bsky.feed.generator',  // 元の collection に合わせる
          rkey: 'skyblurCustomFeed',  // 削除したい rkey を指定
        });

        await agent.post('com.atproto.repo.applyWrites', {
          input: {
            repo: did as ActorIdentifier,
            writes,
          },
        });


      }

    } catch (e) {
      console.error(e)
    }

  }


  const handleSave = async () => {
    if (!agent || !did) return
    setFeedUpdateMessage("")
    setIsSave(true)

    notifications.show({
      title: locale.Menu_Settings,
      loading: true,
      autoClose: false,
      message: locale.Pref_SaveIsInProgress,
    });
    try {
      await handleCustomFeed(isCustomFeed)
      await handleIsUseMyPage(isUseMyPage)
      notifications.clean()
      notifications.show({
        title: 'Success',
        message: locale.Pref_SaveCompleted,
        color: 'teal',
        icon: <HiCheck />
      });
      router.push('/')
    } catch (e) {
      notifications.clean()
      setFeedUpdateMessage('Error:' + e)
    }
    setIsSave(false)

  }


  if (!isMounted) {
    return (
      <Loading />
    );
  }

  return (
    < >
      <main className="">
        <>
          <div className="flex items-center justify-center h-full mt-4 mx-4">
            {locale.Pref_Title}
          </div>
          <div className="mx-auto max-w-screen-md px-4 relative">
            <>
              <>
                <LoadingOverlay visible={isLoading} zIndex={1000} overlayProps={{ radius: "sm", blur: 1 }} />
                <span>{locale.Pref_MyPage}</span>
                <div className="block text-sm text-gray-400 mt-1">{locale.Pref_MyPagePublishDescription}</div>
                <div className="flex items-center mt-2 space-x-2">
                  <Switch
                    checked={isUseMyPage}
                    onChange={(event) => setIsUseMyPage(event.currentTarget.checked)}

                    label={locale.Pref_MyPagePublish}
                  />
                </div>
                {isUseMyPage && (
                  <>
                    <div className="block text-m text-gray-400 mt-1">{locale.Pref_MyPageDesc}</div>
                    <Textarea
                      value={myPageDescription}
                      styles={{
                        input: {
                          fontSize: 16,
                        },
                      }}
                      onChange={(e) => setMyPageDescription(e.target.value)}
                      maxLength={1000} />
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
                  <Switch
                    checked={isCustomFeed}
                    onChange={(event) => setIsCustomFeed(event.currentTarget.checked)}

                    label={locale.Pref_CustomFeedPublish}
                  />
                </div>
                {isCustomFeed && (
                  <>

                    <div className="block text-m mt-1">{locale.Pref_CustomFeedName}</div>
                    <TextInput
                      value={feedName}
                      onChange={(e) => setFeedName(e.target.value)}
                      maxLength={24}
                      styles={{
                        input: {
                          fontSize: 16,
                        },
                      }}
                    />
                    <div className="block text-m mt-1">{locale.Pref_CustomFeedDescription}</div>
                    <Textarea
                      value={feedDescription}
                      styles={{
                        input: {
                          fontSize: 16,
                        },
                      }}
                      onChange={(e) => setFeedDescription(e.target.value)}
                      maxLength={200} />
                    <div className="block text-m mt-1">{locale.Pref_CustomFeedAvatar}</div>
                    {feedAvatarImg &&
                      <p>
                        <Image src={feedAvatarImg} width={50} height={50} alt="Feed Avatar Image" />
                      </p>
                    }
                    <input type="file" accept=".png, .jpg, .jpeg" className="mb-2 w-[300px] inline-block text-sm sm:text-base" onChange={changeFeedAvatar} />
                    <div className="block text-sm text-gray-600 mt-1">
                      <div className="flex flex-col items-center ">
                        <URLCopyButton url={`https://bsky.app/profile/${did}/feed/skyblurCustomFeed`} />
                      </div>
                    </div>
                  </>
                )}

                <div className="flex flex-col items-center gap-2 mt-6">
                  <Button
                    onClick={handleSave}
                    loading={isSave}
                    loaderProps={{ type: 'dots' }}
                  >
                    {locale.Pref_CustomFeedButton}
                  </Button>
                  <div className="text-red-500 mb-1">{feedUpdateMessage}</div>
                </div>
              </>
            </>
          </div>
          <div className="flex flex-col items-center gap-4 mt-6">
            <Link href="/">
              <Button
                variant="default"
                color="gray"
                leftSection={<MdArrowBack />}
              >
                {locale.Menu_Back}
              </Button>
            </Link>
          </div>
        </>

      </main>
    </ >
  );
}
