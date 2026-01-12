"use client"
import { Avatar } from "@/components/Avatar";
import Loading from "@/components/Loading";
import { PostList } from "@/components/PostList";
import PostLoading from "@/components/PostLoading";
import { fetchServiceEndpointWithCache, getPreference } from "@/logic/HandleBluesky";
import { useLocale } from "@/state/Locale";
import { useXrpcAgentStore } from "@/state/XrpcAgent";
import { AppBskyActorDefs } from '@atcute/bluesky';
import { Client, simpleFetchHandler } from '@atcute/client';
import { ActorIdentifier } from '@atcute/lexicons/syntax';
import Head from 'next/head';
import { useParams } from 'next/navigation';
import { useEffect, useState } from "react";

export const ProfilePage = () => {
    const params = useParams<{ did: string }>();
    const did = params?.did ?? ''
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const [errorMessage, setErrorMessage] = useState<string>('')
    const [userProf, setUserProf] = useState<AppBskyActorDefs.ProfileViewDetailed>()
    const [myPageDescription, setMyPageDescription] = useState<string>('')
    const { localeData: locale } = useLocale();
    const apiAgent = useXrpcAgentStore((state) => state.publicAgent);
    const [agent, setAgent] = useState<Client | null>(null)
    const [repo, setRepo] = useState<string>('')
    const [isMyPage, setIsMyPage] = useState<boolean>(false)
    const [pdsUrl, setPdsUrl] = useState<string>('')
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        if (did) {
            const fetchRecord = async () => {

                try {
                    let repoLocal = Array.isArray(did) ? did[0] : did; // 配列なら最初の要素を使う
                    repoLocal = repoLocal.replace(/%3A/g, ':');
                    let pdsUrl = await fetchServiceEndpointWithCache(repoLocal, false)

                    let pdsAgent = new Client({
                        handler: simpleFetchHandler({
                            service: pdsUrl ?? '',
                        }),
                    })

                    setPdsUrl(pdsUrl || '')
                    setRepo(repoLocal)
                    setIsLoading(true);
                    setErrorMessage('')

                    const userProfileResponse = await apiAgent.get('app.bsky.actor.getProfile', {
                        params: { actor: repoLocal as ActorIdentifier },
                    })

                    if (!userProfileResponse.ok) {
                        setErrorMessage('Get Profile Failed.s');
                        setIsLoading(false); // ローディング状態を終了
                        return
                    }

                    try {
                        getPostResponse(repoLocal, pdsAgent)
                    } catch (e) {
                        console.error(e)
                        pdsUrl = await fetchServiceEndpointWithCache(repo, true)

                        pdsAgent = new Client({
                            handler: simpleFetchHandler({
                                service: pdsUrl ?? '',
                            }),
                        })

                        getPostResponse(repoLocal, pdsAgent)

                    }

                    // userProfileのデータをセット
                    setUserProf(userProfileResponse.data);
                    setIsLoading(false); // ローディング状態を終了
                } catch (err) {
                    setErrorMessage(err + '');
                } finally {
                    setIsLoading(false);
                }
            };

            fetchRecord();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [did]); // did または rkey が変更された場合に再実行


    async function getPostResponse(repo: string, pdsAgent: Client) {
        try {
            const value = await getPreference(pdsAgent, repo,)

            if (!value) return
            if (value.myPage.isUseMyPage) {
                setMyPageDescription(value.myPage.description || '')
                setIsMyPage(value.myPage.isUseMyPage)
                setAgent(pdsAgent)
                return
            }

        } catch (e) {
            console.error('エラーだよ' + e)
            throw e

        }

        console.error('エラーだよ')
        setErrorMessage(locale.Profile_NotPublish);

    }

    if (!isMounted) {
        return (
            <Loading />
        );
    }

    return (
        <>
            <Head>
                <meta name="robots" content="noindex, nofollow" />
            </Head>

            {/* 初期読み込み中は全体をローディング表示 */}
            {isLoading ? (
                <Loading />
            ) : (
                <div className="mx-auto max-w-screen-sm md:mt-6 mt-3 mx-2">
                    <div className="mx-auto rounded-lg">
                        {userProf &&
                            <div className="mb-2 mx-2">
                                <Avatar userProf={userProf} href={isMyPage ? `https://${window.location.hostname}/profile/${userProf.did}` : `https://bsky.app/profile/${userProf.did}`} target={isMyPage ? `` : `_blank`} />
                            </div>
                        }

                        {myPageDescription &&
                            <div className="whitespace-pre-wrap break-words mx-3 my-4">
                                {myPageDescription}
                            </div>
                        }

                        {!errorMessage &&
                            <>
                                {agent &&
                                    <div className="mx-auto max-w-screen-sm">
                                        <PostList agent={agent} handleEdit={null} did={repo} pds={pdsUrl} />
                                    </div>
                                }
                            </>
                        }

                        {errorMessage &&
                            <div className="flex justify-center">
                                <div className="whitespace-pre-wrap break-words text-gray-600 mx-2 mt-4">
                                    {locale.Profile_NotPublish}
                                </div>
                            </div>
                        }
                    </div>
                </div>
            )}

        </>
    );
};

export default ProfilePage;
