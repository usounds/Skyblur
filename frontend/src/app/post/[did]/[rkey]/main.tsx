"use client"
import { Avatar } from "@/components/Avatar";
import Loading from "@/components/Loading";
import PostLoading, { AvatarLoading, PostBodyLoading } from "@/components/PostLoading";
import PostTextWithBold from "@/components/PostTextWithBold";
import Reaction from "@/components/Reaction";
import { UkSkyblurPost, UkSkyblurPostDecryptByCid } from '@/lexicon/UkSkyblur';
import { fetchServiceEndpointWithCache, getPreference } from "@/logic/HandleBluesky";
import { formatDateToLocale } from "@/logic/LocaledDatetime";
import { useLocale } from "@/state/Locale";
import { useXrpcAgentStore } from "@/state/XrpcAgent";
import { SKYBLUR_POST_COLLECTION, VISIBILITY_LOGIN, VISIBILITY_FOLLOWERS, VISIBILITY_FOLLOWING, VISIBILITY_MUTUAL } from '@/types/types';
import { AppBskyActorDefs } from '@atcute/bluesky';
import { Client, simpleFetchHandler } from '@atcute/client';
import { ActorIdentifier, ResourceUri } from '@atcute/lexicons/syntax';
import { Button, Divider, Group, Input } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from "react";
import { X } from 'lucide-react';
import { BlueskyIcon } from '@/components/Icons';

export const PostPage = () => {
    const params = useParams();
    const did = Array.isArray(params?.did) ? params?.did[0] : params?.did;
    const rkey = Array.isArray(params?.rkey) ? params?.rkey[0] : params?.rkey;
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const [isMyPage, setIsMyPage] = useState<boolean>(false)
    const [postText, setPostText] = useState<string>('')
    const [addText, setAddText] = useState("");
    const [bskyUrl, setBskyUrl] = useState("");
    const [postAtUri, setPostAtUri] = useState("");
    const [postDate, setPostDate] = useState<string>('')
    const [errorMessage, setErrorMessage] = useState<string>('')
    const [userProf, setUserProf] = useState<AppBskyActorDefs.ProfileViewDetailed>()
    const { localeData: locale } = useLocale();
    const apiAgent = useXrpcAgentStore((state) => state.publicAgent);
    const apiProxyAgent = useXrpcAgentStore((state) => state.apiProxyAgent);
    const [encryptKey, setEncryptKey] = useState("");
    const [encryptCid, setEncryptCid] = useState('')
    const [isDecrypt, setIsDecrypt] = useState<boolean>(false)
    const [isDecrypting, setIsDecrypting] = useState<boolean>(false)
    const [pdsUrl, setPdsUrl] = useState("");
    const [isMounted, setIsMounted] = useState(false);
    const loginDid = useXrpcAgentStore((state) => state.did);
    const isSessionChecked = useXrpcAgentStore((state) => state.isSessionChecked);
    const setIsLoginModalOpened = useXrpcAgentStore((state) => state.setIsLoginModalOpened);
    const [visibility, setVisibility] = useState<string>('');
    const [debugStatus, setDebugStatus] = useState<string>('Idle');
    const [isRestrictedFetchDone, setIsRestrictedFetchDone] = useState<boolean>(false);
    const [isRestrictedFetching, setIsRestrictedFetching] = useState<boolean>(false);

    const aturi = 'at://' + did + "/" + SKYBLUR_POST_COLLECTION + "/" + rkey



    const getPostData = async (passwordArg?: string) => {
        if (!did || !rkey) return;

        console.log(`[PostPage] getPostData called for ${aturi}, pass=${!!passwordArg}`);
        if (!passwordArg) {
            setIsLoading(true);
            setErrorMessage('');
        }

        try {
            // Ensure we have PDS URL
            let repo = Array.isArray(did) ? did[0] : did;
            repo = repo.replace(/%3A/g, ':');

            // Fetch PDS URL (needed for decryption later if password protected)
            let pdsUrlFetched = await fetchServiceEndpointWithCache(repo, false);
            setPdsUrl(pdsUrlFetched || '');

            // Unify fetch: user uk.skyblur.post.getPost directly
            // This handles both public and restricted content in one go

            // We use apiProxyAgent which should handle Auth header if user is logged in
            const res = await apiProxyAgent.post('uk.skyblur.post.getPost', {
                input: {
                    uri: aturi as ResourceUri,
                    password: passwordArg || '' // Password logic handled separately or initially empty
                }
            });

            console.log("[PostPage] getPost response:", res.status);

            if (res.ok && res.data) {
                const data = res.data as {
                    text: string,
                    additional: string,
                    message?: string,
                    errorCode?: string,
                    createdAt?: string,
                    visibility?: string,
                    encryptCid?: string
                };

                console.log("getPost success:", data);

                // Set Metadata
                if (data.createdAt) setPostDate(formatDateToLocale(data.createdAt));
                if (data.visibility) setVisibility(data.visibility);

                // Construct Bluesky URL (Approximate)
                const convertedUri = aturi.replace('at://did:', 'https://bsky.app/profile/did:').replace('/app.bsky.feed.post/', '/post/');
                setBskyUrl(convertedUri);
                setPostAtUri(aturi);

                // Handle Content
                if (!data.errorCode) {
                    setPostText(data.text);
                    setAddText(data.additional || '');
                    setDebugStatus(`Success. Text len: ${data.text.length}`);

                    // If we successfully got content with password, unlock logic
                    if (passwordArg) {
                        setIsDecrypt(true);
                        setIsDecrypting(false);
                    }
                } else {
                    // It's masked or error
                    // We still set text/additional if provided (e.g. masked '○')
                    setPostText(data.text);
                    setAddText(data.additional || '');

                    // Handle Error Code
                    const code = data.errorCode;
                    let errorMsg = '';

                    if (code === 'NotFollower') {
                        errorMsg = locale.Post_Restricted_NotAuthorized_Followers;
                    } else if (code === 'NotFollowing') {
                        errorMsg = locale.Post_Restricted_NotAuthorized_Following;
                    } else if (code === 'NotMutual') {
                        errorMsg = locale.Post_Restricted_NotAuthorized_Mutual;
                    } else if (code === 'AuthRequired') {
                        errorMsg = locale.Post_Restricted_LoginRequired;
                    } else if (code === 'ContentMissing') {
                        errorMsg = locale.Post_Restricted_ContentMissing;
                    } else if (code === 'PasswordRequired') {
                        // Password required logic
                        if (data.encryptCid) {
                            setEncryptCid(data.encryptCid);
                            setIsDecrypt(false);
                        }
                        // Don't show error notification, UI will show password input
                    } else {
                        // NotAuthorized or other
                        errorMsg = locale.Post_Restricted_NotAuthorized;
                        if (data.message && !errorMsg) errorMsg = data.message;
                    }

                    if (errorMsg) {
                        notifications.show({
                            title: 'Error',
                            message: errorMsg,
                            color: 'red',
                            icon: <X />,
                            autoClose: 10000,
                        });
                    }
                }

                // Fetch User Profile for Avatar
                try {
                    const userProfileResponse = await apiAgent.get('app.bsky.actor.getProfile', {
                        params: { actor: repo as ActorIdentifier },
                    });
                    if (userProfileResponse.ok) {
                        setUserProf(userProfileResponse.data);
                    }
                    await getPreferenceProcess(repo, new Client({ handler: simpleFetchHandler({ service: pdsUrlFetched ?? '' }) }));

                } catch (e) {
                    console.warn("Failed to fetch profile", e);
                }

            } else {
                setErrorMessage('Get Post Failed.');
            }

        } catch (e) {
            console.error("Failed to fetch post", e);
            setErrorMessage(String(e));
        } finally {
            setIsLoading(false);
            setIsRestrictedFetchDone(true);
        }
    }

    useEffect(() => {
        setIsMounted(true);
        if (did && rkey && isSessionChecked) {
            getPostData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [did, rkey, isSessionChecked, loginDid]);



    async function getPreferenceProcess(repo: string, pdsAgent: Client) {
        try {
            const preference = await getPreference(pdsAgent, repo)
            if (preference?.myPage.isUseMyPage) setIsMyPage(true)
        } catch (e) {
            console.log(e)

        }
    }

    async function handleDecrypt() {
        if (!encryptKey) {
            notifications.show({
                title: 'Error',
                message: locale.DeleteList_DecryptRequired,
                color: 'red',
                icon: <X />
            });
            return
        }
        setIsDecrypting(true)

        // Use Unified getPostData with password
        await getPostData(encryptKey);
    }

    async function getPostResponse(repo: string, rkey: string, pdsAgent: Client) {
        try {
            return await pdsAgent.get('com.atproto.repo.getRecord', {
                params: {
                    repo: repo as ActorIdentifier,
                    collection: SKYBLUR_POST_COLLECTION,
                    rkey: rkey,
                },
            });
        } catch (e) {
            console.log(e)
            return await pdsAgent.get('com.atproto.repo.getRecord', {
                params: {
                    repo: repo as ActorIdentifier,
                    collection: SKYBLUR_POST_COLLECTION,
                    rkey: rkey,
                },
            });
        }
    }


    if (!isMounted) {
        return (
            <Loading />
        );
    }

    const isRestrictedVisibility = [VISIBILITY_FOLLOWERS, VISIBILITY_FOLLOWING, VISIBILITY_MUTUAL].includes(visibility as any) || visibility === 'UNKNOWN';
    const isMaskedText = /^([○◯]+)$/.test(postText.trim());
    const isRestrictedTarget = isRestrictedVisibility || (isMaskedText && !visibility);

    const isMasked = isMaskedText;
    const shouldShowLoading = !isSessionChecked || isLoading || (isRestrictedTarget && loginDid && !isRestrictedFetchDone);
    console.log(`PostPage Render: postText='${postText}', isMasked=${isMasked}, shouldShowLoading=${shouldShowLoading}, loginDid=${!!loginDid}, isSessionChecked=${isSessionChecked}`);

    return (
        <>
            <link rel="alternate" href={aturi} />


            <div className="mx-auto max-w-screen-sm md:mt-6 mt-3 mx-2">
                <div className="mx-auto rounded-lg">
                    {isLoading || !userProf ? (
                        <div className="mb-2 mx-2">
                            <AvatarLoading />
                        </div>
                    ) : (
                        <div className="mb-2 mx-2">
                            <Avatar userProf={userProf} href={isMyPage ? `https://${window.location.hostname}/profile/${userProf.did}` : `https://bsky.app/profile/${userProf.did}`} target={isMyPage ? `` : `_blank`} />
                        </div>
                    )}

                    {shouldShowLoading ?
                        <div className="">
                            <PostBodyLoading />
                        </div>
                        :
                        <>
                            {!errorMessage &&
                                <>
                                    {/* DEBUG BANNER - TEMPORARY */}
                                    {/* DEBUG BANNER REMOVED */}

                                    <div className="p-2 mx-2 max-w-screen-sm">
                                        {((visibility === VISIBILITY_LOGIN || visibility === VISIBILITY_FOLLOWERS || visibility === VISIBILITY_FOLLOWING || visibility === VISIBILITY_MUTUAL) && !loginDid) ? (
                                            <div className="flex flex-col items-center justify-center m-4 gap-4">
                                                <div className="text-sm text-gray-500">
                                                    {(visibility === VISIBILITY_LOGIN) && "この投稿を参照するにはログインが必要です。"}
                                                    {(visibility === VISIBILITY_FOLLOWERS) && "この投稿はフォロワー限定です。参照するにはログインが必要です。"}
                                                    {(visibility === VISIBILITY_FOLLOWING) && "この投稿はフォロー中限定です。参照するにはログインが必要です。"}
                                                    {(visibility === VISIBILITY_MUTUAL) && "この投稿は相互フォロー限定です。参照するにはログインが必要です。"}
                                                </div>
                                                <Button
                                                    color="blue"
                                                    size="sm"
                                                    onClick={() => setIsLoginModalOpened(true)}
                                                    leftSection={<BlueskyIcon size={18} />}
                                                >
                                                    {locale.Login_Login}
                                                </Button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="overflow-hidden break-words">
                                                    {isMasked ? (
                                                        <div
                                                            className="text-lg"
                                                        >
                                                            {postText}
                                                        </div>
                                                    ) : (
                                                        <PostTextWithBold postText={postText} isValidateBrackets={true} isMask={null} />
                                                    )}
                                                </div>
                                                {addText &&
                                                    <div className="">
                                                        <Divider mx='sm' my="sm" />
                                                        <PostTextWithBold postText={addText} isValidateBrackets={false} isMask={null} />
                                                    </div>
                                                }
                                            </>
                                        )}

                                        {(encryptCid && !isDecrypt) &&
                                            <>
                                                <div className="block text-sm text-gray-400 mt-1">この投稿はパスワードが設定されています。伏せた文字と補足を参照するにはパスワードを入力して「解除」してください</div>
                                                <div className="flex flex-row items-center justify-center m-2"> {/* Flexbox with centered alignment */}
                                                    <Group justify="center" gap="sm" mt="xs">
                                                        <Input
                                                            value={encryptKey ?? ""}
                                                            size="xs"
                                                            styles={{
                                                                input: {
                                                                    fontSize: 16,
                                                                },
                                                            }}
                                                            onChange={(e) => setEncryptKey(e.target.value)}
                                                        />
                                                        <Button
                                                            color="blue"
                                                            size="xs"
                                                            onClick={() => handleDecrypt()}
                                                            loading={isDecrypting}
                                                            loaderProps={{ type: 'dots' }}
                                                        >
                                                            {locale.DeleteList_DecryptButton}
                                                        </Button>
                                                    </Group>
                                                </div>
                                            </>
                                        }

                                        <div className="flex justify-between items-center mt-2">
                                            <div className="flex items-center gap-2">
                                                <div className="text-sm text-gray-400 mr-2">{postDate}</div>
                                                <Reaction atUriPost={postAtUri} atUriBlur={aturi} />
                                            </div>
                                            <div className="flex">
                                                <a className="text-sm text-gray-500" href={bskyUrl} target="_blank">
                                                    <BlueskyIcon size={22} />
                                                </a>
                                            </div>
                                        </div>

                                    </div>

                                    {isMyPage && (
                                        <>
                                            <div className="flex justify-center mt-10">
                                                <Link href={`/profile/${did}`}>
                                                    <Button variant="outline" color="gray">{locale.Post_GoMyPage}</Button>
                                                </Link>
                                            </div>
                                        </>
                                    )
                                    }

                                </>
                            }
                        </>
                    }

                    {errorMessage &&
                        <div className="whitespace-pre-wrap break-words text-red-800">
                            {errorMessage}
                        </div>
                    }
                </div>
            </div >

        </>
    );
};

export default PostPage;
