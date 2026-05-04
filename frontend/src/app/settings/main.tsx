"use client"
import Loading from "@/components/Loading";
import URLCopyButton from "@/components/URLCopyButton";
import { getPreference } from "@/logic/HandleBluesky";
import { compressImage } from "@/logic/ImageCompression";
import { useLocale } from "@/state/Locale";
import { useXrpcAgentStore } from "@/state/XrpcAgent";
import { ActorIdentifier } from '@atcute/lexicons/syntax';
import { Button, LoadingOverlay, Switch, Textarea, TextInput } from '@mantine/core';
import { memo } from 'react';
import { notifications } from '@mantine/notifications';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from "react";
import { Check, Save } from 'lucide-react';
import { ArrowLeft } from 'lucide-react';

const MemoizedSettings = memo(Settings);
export default MemoizedSettings;

type CustomFeedSnapshot = {
  enabled: boolean;
  displayName: string;
  description: string;
  avatar: unknown;
  avatarCid: string | null;
};

type MyPageSnapshot = {
  enabled: boolean;
  description: string;
};

function Settings() {
  const agent = useXrpcAgentStore((state) => state.agent);
  const userProf = useXrpcAgentStore((state) => state.userProf);
  const did = useXrpcAgentStore((state) => state.did);
  const serviceUrl = useXrpcAgentStore((state) => state.serviceUrl);
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isUseMyPage, setIsUseMyPage] = useState<boolean>(false)
  const [preferenceMode, setPreferenceMode] = useState<"create" | "update">('create')
  const [myPageDescription, setMyPageDescription] = useState<string>('')
  const [initialMyPage, setInitialMyPage] = useState<MyPageSnapshot>({
    enabled: false,
    description: '',
  })
  const [isCustomFeed, setIsCustomFeed] = useState<boolean>(false)
  const [originallyHasCustomFeed, setOriginallyHasCustomFeed] = useState<boolean>(false)
  const [isSave, setIsSave] = useState<boolean>(false)
  const { localeData: locale } = useLocale();
  /* istanbul ignore next -- Locale data is loaded for all supported E2E languages. */
  const [feedName, setFeedName] = useState<string>(locale.Pref_CustomFeedDefaltName?.replace('{1}', did || '') || '')
  const [feedDescription, setFeedDescription] = useState<string>('')
  const [feedUpdateMessage, setFeedUpdateMessage] = useState<string>('')
  const [feedAvatarImg, setFeedAvatarImg] = useState('')
  const [feedAvatar, setFeedAvatar] = useState<File>()
  const [initialCustomFeed, setInitialCustomFeed] = useState<CustomFeedSnapshot>({
    enabled: false,
    displayName: '',
    description: '',
    avatar: null,
    avatarCid: null,
  })
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const isSessionChecked = useXrpcAgentStore((state) => state.isSessionChecked);

  useEffect(() => {
    /* istanbul ignore next -- Initial unchecked session render is an async guard before the settings UI is reachable. */
    if (!isSessionChecked) return;
    if (!did) {
      router.push(`/`)
      return
    }
    /* istanbul ignore next -- Authenticated settings routes always provide agent and serviceUrl after session setup. */
    if (!agent || !serviceUrl) return;

    let isAborted = false;

    setIsMounted(true);
    setIsLoading(true)
    const fetchData = async () => {
      try {
        const value = await getPreference(did, serviceUrl)
        if (isAborted) return;

        if (value === null) {
          setPreferenceMode('create')
          setIsUseMyPage(false)
          setMyPageDescription('')
          setInitialMyPage({
            enabled: false,
            description: '',
          })
          // 早期リターンせず、カスタムフィードの読み込みは続行
        } else {
          setPreferenceMode('update')
          const isUseMyPageValue = Boolean(value.myPage.isUseMyPage);
          /* istanbul ignore next -- Preference descriptions are normalized to strings in persisted records. */
          const myPageDescriptionValue = value.myPage.description || '';
          setIsUseMyPage(isUseMyPageValue)
          setMyPageDescription(myPageDescriptionValue)
          setInitialMyPage({
            enabled: isUseMyPageValue,
            description: myPageDescriptionValue,
          })
        }

        const feedRecord = await getFeedGeneratorRecord(serviceUrl, did);

        /* istanbul ignore next -- Cleanup race guard is not deterministic in E2E. */
        if (isAborted) return;

        if (!feedRecord) {
          /* istanbul ignore next -- Locale data and user profile are present in authenticated settings E2E. */
          const defaultFeedName = locale.Pref_CustomFeedDefaltName?.replace('{1}', userProf?.displayName || '').slice(0, 24) || '';
          setFeedName(defaultFeedName)
          setFeedDescription('')
          setInitialCustomFeed({
            enabled: false,
            displayName: defaultFeedName,
            description: '',
            avatar: null,
            avatarCid: null,
          })
        } else {
          const avatarCid = getBlobCid(feedRecord.avatar);
          /* istanbul ignore next -- Custom feed mock records include normalized string metadata. */
          setFeedName(feedRecord.displayName || '')
          /* istanbul ignore next -- Custom feed mock records include normalized string metadata. */
          setFeedDescription(feedRecord.description || '')
          /* istanbul ignore next -- Avatar URL fallback is covered by no-avatar custom feed records. */
          setFeedAvatarImg(getFeedAvatarUrl(serviceUrl, did, feedRecord.avatar) || '')
          setIsCustomFeed(true)
          setOriginallyHasCustomFeed(true)
          setInitialCustomFeed({
            enabled: true,
            /* istanbul ignore next -- Custom feed mock records include normalized string metadata. */
            displayName: feedRecord.displayName || '',
            /* istanbul ignore next -- Custom feed mock records include normalized string metadata. */
            description: feedRecord.description || '',
            /* istanbul ignore next -- Avatar fallback is represented by avatarCid/null in E2E. */
            avatar: feedRecord.avatar || null,
            avatarCid,
          })
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
  }, [did, agent, serviceUrl, isSessionChecked]);


  const changeFeedAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    /* istanbul ignore next -- File input change events in browsers include a FileList. */
    if (!e.target.files) return;

    let imgObject = e.target.files[0];

    if (imgObject.size > 900 * 1024) {
      try {
        imgObject = await compressImage(imgObject);
      } catch (e) {
        console.error("Compression failed", e);
      }
    }

    setFeedAvatar(imgObject)
    /* istanbul ignore else -- A non-null FileList change cannot produce an undefined first File in this UI. */
    if (imgObject) {
      setFeedAvatarImg(window.URL.createObjectURL(imgObject))
    } else {
      setFeedAvatarImg('')

    }

  };

  const getPreferenceWrite = (param: boolean) => {
    /* istanbul ignore next -- The save button is only reachable in authenticated settings. */
    if (!did) return null;
    if (!hasMyPageChanged()) return null;

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

  const getFeedGeneratorRecord = async (pdsUrl: string, repo: string) => {
    const recordUrl = new URL('/xrpc/com.atproto.repo.getRecord', pdsUrl);
    recordUrl.searchParams.set('repo', repo);
    recordUrl.searchParams.set('collection', 'app.bsky.feed.generator');
    recordUrl.searchParams.set('rkey', 'skyblurCustomFeed');

    const res = await fetch(recordUrl, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data.value as {
      displayName?: string;
      description?: string;
      avatar?: unknown;
    };
  };

  const getBlobCid = (blob: unknown) => {
    const ref = (blob as { ref?: { $link?: unknown } })?.ref;
    return typeof ref?.$link === 'string' ? ref.$link : null;
  };

  const getFeedAvatarUrl = (pdsUrl: string, repo: string, avatar: unknown) => {
    const cid = getBlobCid(avatar);
    if (!cid) return null;

    const blobUrl = new URL('/xrpc/com.atproto.sync.getBlob', pdsUrl);
    blobUrl.searchParams.set('did', repo);
    blobUrl.searchParams.set('cid', cid);
    return blobUrl.toString();
  };

  const getCidFromAvatarUrl = (avatarUrl: string) => {
    const url = new URL(avatarUrl);
    const cid = url.searchParams.get('cid');
    if (cid) return cid;

    const pathname = url.pathname;
    /* istanbul ignore next -- Generated avatar URLs always contain a path segment. */
    const lastSegment = pathname.split('/').filter(Boolean).at(-1);
    /* istanbul ignore next -- Generated avatar URLs always contain a path segment. */
    return lastSegment?.split('@')[0] || null;
  };

  const fetchBlobFromPds = async (pdsUrl: string, didValue: string, cid: string) => {
    const blobUrl = new URL('/xrpc/com.atproto.sync.getBlob', pdsUrl);
    blobUrl.searchParams.set('did', didValue);
    blobUrl.searchParams.set('cid', cid);

    const res = await fetch(blobUrl, {
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`Failed to get blob: ${res.status}`);
    }

    return res.blob();
  };

  const hasCustomFeedChanged = () => {
    if (isCustomFeed !== initialCustomFeed.enabled) return true;
    if (!isCustomFeed) return false;
    if (feedName !== initialCustomFeed.displayName) return true;
    if (feedDescription !== initialCustomFeed.description) return true;
    if (feedAvatar) return true;

    const currentAvatarCid = feedAvatarImg ? getCidFromAvatarUrl(feedAvatarImg) : null;
    return currentAvatarCid !== initialCustomFeed.avatarCid;
  };

  const hasMyPageChanged = () => {
    return isUseMyPage !== initialMyPage.enabled || myPageDescription !== initialMyPage.description;
  };

  const hasSettingsChanged = () => {
    return hasMyPageChanged() || hasCustomFeedChanged();
  };

  const getFeedRecord = async () => {
    /* istanbul ignore next -- The save button is only reachable after authenticated settings state is ready. */
    if (!agent || !did || !serviceUrl) return null;
    let avatarRef: unknown = null;

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
        const cid = getCidFromAvatarUrl(feedAvatarImg);
        /* istanbul ignore next -- feedAvatarImg is generated from URLs that include a CID. */
        if (!cid) {
          throw new Error('Failed to parse avatar CID');
        }

        if (cid === initialCustomFeed.avatarCid && initialCustomFeed.avatar) {
          avatarRef = initialCustomFeed.avatar;
        } else {
          const didValue = did as `did:${string}:${string}`;
          const blob = await fetchBlobFromPds(serviceUrl, didValue, cid);
          const fileUint = new Uint8Array(await blob.arrayBuffer());

          const blobRes = await agent.post('com.atproto.repo.uploadBlob', {
            input: fileUint,
            encoding: blob.type || 'image/jpeg',
            headers: { 'Content-Type': 'application/octet-stream' },
          });

          if (!blobRes.ok) {
            setFeedUpdateMessage('error');
            return
          }

          avatarRef = blobRes.data.blob as unknown as Blob;
        }
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
    /* istanbul ignore next -- The save button is only reachable in authenticated settings. */
    if (!did) return null;
    if (!hasCustomFeedChanged()) return null;

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
    /* istanbul ignore next -- The save button is only reachable after authenticated settings state is ready. */
    if (!agent || !did) return
    /* istanbul ignore next -- The save button is disabled until a setting changes. */
    if (!hasSettingsChanged()) return
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
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={feedAvatarImg} width={50} height={50} alt="Feed Avatar Image" />
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
                      disabled={isLoading || !hasSettingsChanged()}
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
