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



    const getRestrictedPost = async (uri: string) => {
        console.log(`[PostPage] getRestrictedPost called for ${uri}`);
        setIsRestrictedFetching(true);
        try {
            notifications.show({
                id: 'auth-check',
                title: 'Loading',
                message: locale.Post_Restricted_FetchingAuth,
                loading: true,
                autoClose: false,
                withCloseButton: false,
            });

            setDebugStatus('Fetching...');

            const res = await apiProxyAgent.post('uk.skyblur.post.getPost', {
                input: {
                    uri: uri as ResourceUri
                }
            });
            console.log("[PostPage] getRestrictedPost response:", res.status);

            notifications.hide('auth-check');

            if (res.ok && res.data) {
                const data = res.data as { text: string, additional: string, debug?: any };
                console.log("getRestrictedPost success:", data);
                setDebugStatus(`Success. Text len: ${data.text.length}, Debug: ${JSON.stringify(data.debug)}`);

                // If we have real content (not masked), update the UI
                if (data.text !== '◯') {
                    setPostText(data.text);
                    setAddText(data.additional || '');
                    // Clear error message in case it was set previously (though we don't use it anymore)
                    setErrorMessage('');
                } else if (data.debug) {
                    // It's masked, check debug reason for error notification
                    const reason = data.debug.reason;
                    let errorMsg = '';
                    if (reason === 'Not authorized') {
                        if (visibility === VISIBILITY_FOLLOWERS) {
                            errorMsg = locale.Post_Restricted_NotAuthorized_Followers;
                        } else if (visibility === VISIBILITY_FOLLOWING) {
                            errorMsg = locale.Post_Restricted_NotAuthorized_Following;
                        } else if (visibility === VISIBILITY_MUTUAL) {
                            errorMsg = locale.Post_Restricted_NotAuthorized_Mutual;
                        } else {
                            errorMsg = locale.Post_Restricted_NotAuthorized;
                        }
                    } else if (reason === 'No requesterDid') {
                        errorMsg = locale.Post_Restricted_LoginRequired;
                    } else if (reason === 'Content missing in DO') {
                        errorMsg = locale.Post_Restricted_ContentMissing;
                    } else {
                        errorMsg = `Restricted content access denied: ${JSON.stringify(data.debug)}`;
                    }

                    if (errorMsg) {
                        notifications.show({
                            title: 'Error',
                            message: errorMsg,
                            color: 'red',
                            icon: <X />,
                            autoClose: 10000, // Longer timeout for auth errors
                        });
                    }
                }
            } else {
                setDebugStatus(`Fetch failed. OK=${res.ok}, Status=${res.status}`);
                notifications.show({
                    title: 'Error',
                    message: "Failed to fetch content.",
                    color: 'red',
                    icon: <X />
                });
            }
        } catch (e) {
            console.error("Failed to fetch restricted content", e);
            notifications.hide('auth-check');
            setDebugStatus(`Fetch Error: ${e}`);
            notifications.show({
                title: 'Error',
                message: "Failed to fetch restricted content: " + String(e),
                color: 'red',
                icon: <X />
            });
        } finally {
            setIsRestrictedFetching(false);
            setIsRestrictedFetchDone(true);
        }
    }

    useEffect(() => {
        setIsMounted(true);
        if (did && rkey) {



            const fetchRecord = async () => {

                try {
                    let repo = Array.isArray(did) ? did[0] : did; // 配列なら最初の要素を使う
                    repo = repo.replace(/%3A/g, ':');
                    const rkeyParam = Array.isArray(rkey) ? rkey[0] : rkey; // 配列なら最初の要素を使う
                    setIsLoading(true);
                    setErrorMessage('')

                    let pdsUrl = await fetchServiceEndpointWithCache(repo, false)

                    let pdsAgent = new Client({
                        handler: simpleFetchHandler({
                            service: pdsUrl ?? '',
                        }),
                    })

                    setPdsUrl(pdsUrl || '')

                    try {
                        let userProfileResponse = await apiAgent.get('app.bsky.actor.getProfile', {
                            params: { actor: repo as ActorIdentifier },
                        })

                        const postResponse = await getPostResponse(repo, rkeyParam, pdsAgent)
                        await getPreferenceProcess(repo, pdsAgent)

                        if (!userProfileResponse.ok) {
                            pdsUrl = await fetchServiceEndpointWithCache(repo, true)
                            pdsAgent = new Client({
                                handler: simpleFetchHandler({
                                    service: pdsUrl ?? '',
                                }),
                            })

                            userProfileResponse = await apiAgent.get('app.bsky.actor.getProfile', {
                                params: { actor: repo as ActorIdentifier },
                            })

                            if (!userProfileResponse.ok) {

                                setErrorMessage('Get Profile Failed.');
                                setIsLoading(false);
                                return
                            }
                        }
                        if (!postResponse.ok) {
                            setErrorMessage('Get Post Failed.');
                            setIsLoading(false);
                            return

                        }

                        // userProfileのデータをセット
                        setUserProf(userProfileResponse.data);

                        // postDataのデータをセット
                        const postData: UkSkyblurPost.Record = postResponse.data.value as unknown as UkSkyblurPost.Record;

                        const tempPostText = postData.text

                        setPostText(tempPostText);
                        setAddText(postData.additional || '');
                        setPostDate(formatDateToLocale(postData.createdAt));
                        const vis: string = postData.visibility || '';
                        setVisibility(vis);

                        const convertedUri = postData.uri.replace('at://did:', 'https://bsky.app/profile/did:').replace('/app.bsky.feed.post/', '/post/');
                        setBskyUrl(convertedUri)
                        const blurUri = postResponse.data.uri;
                        setPostAtUri(blurUri);

                        setIsLoading(false); // Metadata fetch done

                        // Auto-fetch restricted content if logged in and visibility suggests it's restricted
                        const isRestrictedTarget = [VISIBILITY_FOLLOWERS, VISIBILITY_FOLLOWING, VISIBILITY_MUTUAL].includes(vis) ||
                            (vis === 'UNKNOWN' || (/^([○◯]+)$/.test(tempPostText.trim()) && !vis));

                        if (loginDid && isRestrictedTarget && !isRestrictedFetchDone) {
                            console.log("Auto-fetching restricted content for logged-in user");
                            getRestrictedPost(blurUri);
                        }

                    } catch (err) {
                        // エラーハンドリング
                        setErrorMessage(err + '');
                        setIsLoading(false); // ローディング状態を終了
                    }
                } catch (err) {
                    setErrorMessage(err + '');
                } finally {
                    setIsLoading(false);
                }
            };

            fetchRecord();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [did, rkey]); // Removed loginDid to prevent double-fetch on session restore

    // Effect for auto-fetching restricted content when session is ready
    useEffect(() => {
        const isRestrictedTarget = [VISIBILITY_FOLLOWERS, VISIBILITY_FOLLOWING, VISIBILITY_MUTUAL].includes(visibility as any) ||
            (visibility === 'UNKNOWN' || (/^([○◯]+)$/.test(postText.trim()) && !visibility));

        if (isSessionChecked && loginDid && isRestrictedTarget && postAtUri && !isRestrictedFetchDone && !isRestrictedFetching && !isLoading) {
            console.log("Session ready, auto-fetching restricted content");
            getRestrictedPost(postAtUri);
        }
    }, [isSessionChecked, loginDid, visibility, postText, postAtUri, isRestrictedFetchDone, isRestrictedFetching, isLoading]);


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

        const host = new URL(window.location.origin).host;
        let apiHost = 'api.skyblur.uk'
        if (host?.endsWith('dev.skyblur.uk')) {
            apiHost = 'devapi.skyblur.uk'
        }

        const repo = Array.isArray(did) ? did[0] : did || ''

        const decodedRepo = decodeURIComponent(repo);
        if (!decodedRepo.startsWith('did:')) return
        const validRepo = decodedRepo as `did:${string}:${string}`
        const validPds = pdsUrl as `${string}:${string}`

        const body: UkSkyblurPostDecryptByCid.Input = {
            pds: validPds,
            repo: validRepo,
            cid: encryptCid,
            password: encryptKey,
        }
        const response = await fetch(`https://${apiHost}/xrpc/uk.skyblur.post.decryptByCid`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (response.ok || response.status === 200) {
            const data = await response.json() as UkSkyblurPostDecryptByCid.Output
            setPostText(data.text);
            setAddText(data.additional || '');

            setIsDecrypt(true)
            return
        }

        notifications.show({
            title: 'Error',
            message: locale.DeleteList_DecryptErrorMessage,
            color: 'red',
            icon: <X />
        });
        setIsDecrypting(false)

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
                                                            className="cursor-pointer hover:opacity-70 transition-opacity font-bold text-lg"
                                                            onClick={(e) => {
                                                                console.error("Masked text clicked (Direct div)");
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                getRestrictedPost(aturi);
                                                            }}
                                                            title="Tap to reveal"
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
