"use client"
import Loading from "@/components/Loading";
import URLCopyButton from "@/components/URLCopyButton";
import { getPreference } from "@/logic/HandleBluesky";
import { useLocale } from "@/state/Locale";
import { useXrpcAgentStore } from "@/state/XrpcAgent";
import { ActorIdentifier, ResourceUri } from '@atcute/lexicons/syntax';
import { Button, LoadingOverlay, Switch, Textarea, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import Image from "next/image";
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from "react";
import { Check, Save } from 'lucide-react';
import { ArrowLeft } from 'lucide-react';

export default function Settings() {
  const agent = useXrpcAgentStore((state) => state.agent);
  const userProf = useXrpcAgentStore((state) => state.userProf);
  const did = useXrpcAgentStore((state) => state.did);
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isUseMyPage, setIsUseMyPage] = useState<boolean>(false)
  const [preferenceMode, setPreferenceMode] = useState<"create" | "update">('create')
  const [myPageDescription, setMyPageDescription] = useState<string>('')
  const [isCustomFeed, setIsCustomFeed] = useState<boolean>(false)
  const [originallyHasCustomFeed, setOriginallyHasCustomFeed] = useState<boolean>(false)
  const [isSave, setIsSave] = useState<boolean>(false)
  const { localeData: locale } = useLocale();
  const [feedName, setFeedName] = useState<string>(locale.Pref_CustomFeedDefaltName?.replace('{1}', did || '') || '')
  const [feedDescription, setFeedDescription] = useState<string>('')
  const [feedUpdateMessage, setFeedUpdateMessage] = useState<string>('')
  const [feedAvatarImg, setFeedAvatarImg] = useState('')
  const [feedAvatar, setFeedAvatar] = useState<File>()
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const isSessionChecked = useXrpcAgentStore((state) => state.isSessionChecked);
  const searchParams = useSearchParams();
  const setDid = useXrpcAgentStore((state) => state.setDid);
  const setServiceUrl = useXrpcAgentStore((state) => state.setServiceUrl);
  useEffect(() => {
    if (!isSessionChecked) return;
    if (!did) {
      router.push(`/`)
      return
    }
    if (!agent) return;

    let isAborted = false;

    setIsMounted(true);
    setIsLoading(true)
    const fetchData = async () => {
      try {
        const value = await getPreference(agent, did)
        if (isAborted) return;

        if (value === null) {
          setPreferenceMode('create')
          // 早期リターンせず、カスタムフィードの読み込みは続行
        } else {
          setPreferenceMode('update')
          if (value.myPage.isUseMyPage) setIsUseMyPage(true)
          setMyPageDescription(value.myPage.description || '')
        }

        const feedATUri = 'at://' + did + '/app.bsky.feed.generator/skyblurCustomFeed'
        const result = await agent.get('app.bsky.feed.getFeedGenerator', {
          params: {
            feed: feedATUri as ResourceUri,
          },
        });

        if (isAborted) return;

        if (!result.ok) {
          setFeedName(locale.Pref_CustomFeedDefaltName?.replace('{1}', userProf?.displayName || '').slice(0, 24) || '')
          setFeedDescription('')
        } else {
          setFeedName(result.data.view.displayName)
          setFeedDescription(result.data.view.description || '')
          setFeedAvatarImg(result.data.view.avatar || '')
          setIsCustomFeed(true)
          setOriginallyHasCustomFeed(true)
        }

      } catch (e) {
        console.error("Settings fetchData failed:", e);
      } finally {
        if (!isAborted) setIsLoading(false);
      }
    };

    fetchData();

    return () => {
      isAborted = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [did, agent, isSessionChecked]);


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

  const getPreferenceWrite = (param: boolean) => {
    if (!did) return null;

    return {
      $type: `com.atproto.repo.applyWrites#${preferenceMode}` as const,
      collection: 'uk.skyblur.preference' as `${string}.${string}.${string}`,
      rkey: 'self',
      value: {
        $type: 'uk.skyblur.preference' as any,
        myPage: {
          isUseMyPage: param,
          description: myPageDescription,
        },
      },
    };
  };


  const getFeedRecord = async () => {
    if (!agent || !did) return null;
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

      return {
        $type: 'app.bsky.feed.generator',
        did: 'did:web:feed.skyblur.uk',
        displayName: feedName,
        description: feedDescription,
        createdAt: new Date().toISOString(),
        ...(avatarRef ? { avatar: avatarRef } : {}),
      };
    } catch (e) {
      setFeedUpdateMessage('Error:' + e)
      throw e;
    }
  }

  const getCustomFeedWrite = async (param: boolean) => {
    if (!did) return null;

    if (param) {
      const record = await getFeedRecord();
      if (!record) return null;

      // 最初に読み込まれた時に存在していたなら update、そうでなければ create
      const mode = originallyHasCustomFeed ? 'update' : 'create';
      return {
        $type: `com.atproto.repo.applyWrites#${mode}` as const,
        collection: 'app.bsky.feed.generator' as `${string}.${string}.${string}`,
        rkey: 'skyblurCustomFeed',
        value: record,
      };
    } else if (originallyHasCustomFeed) {
      // 削除する場合（元々存在していた場合のみ）
      return {
        $type: 'com.atproto.repo.applyWrites#delete' as const,
        collection: 'app.bsky.feed.generator' as `${string}.${string}.${string}`,
        rkey: 'skyblurCustomFeed',
      };
    }

    return null;
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
      const writes: any[] = [];

      const feedWrite = await getCustomFeedWrite(isCustomFeed);
      if (feedWrite) writes.push(feedWrite);

      const prefWrite = getPreferenceWrite(isUseMyPage);
      if (prefWrite) writes.push(prefWrite);

      if (writes.length > 0) {
        await agent.post('com.atproto.repo.applyWrites', {
          input: {
            repo: did as ActorIdentifier,
            writes,
          },
        });
      }

      notifications.clean()
      notifications.show({
        title: 'Success',
        message: locale.Pref_SaveCompleted,
        color: 'teal',
        icon: <Check />
      });
      router.push('/console')
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

                <div className="flex justify-between items-center gap-4 mt-6 px-4">
                  <Link
                    href="/console"
                  >
                    <Button
                      variant="default"
                      color="gray"
                      leftSection={<ArrowLeft />}
                    >
                      {locale.Menu_Back}
                    </Button>
                  </Link>
                  <div className="flex flex-col items-end">
                    <Button
                      onClick={handleSave}
                      loading={isSave}
                      loaderProps={{ type: 'dots' }}
                      leftSection={<Save />}
                    >
                      {locale.Pref_CustomFeedButton}
                    </Button>
                    {feedUpdateMessage && <div className="text-red-500 mt-1">{feedUpdateMessage}</div>}
                  </div>
                </div>
              </>
            </>
          </div>
        </>

      </main>
    </>
  );
}
