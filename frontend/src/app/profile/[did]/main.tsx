"use client"
import { Avatar } from "@/components/Avatar";
import Loading from "@/components/Loading";
import { PostList } from "@/components/PostList";
import { getPreference } from "@/logic/HandleBluesky";
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

    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        if (did) {
            const fetchRecord = async () => {

                try {
                    let repoLocal = Array.isArray(did) ? did[0] : did; // 配列なら最初の要素を使う
                    repoLocal = repoLocal.replace(/%3A/g, ':');

                    // Removed manual PDS resolution
                    setRepo(repoLocal)
                    setIsLoading(true);
                    setErrorMessage('')

                    // Fetch user profile from AppView (apiAgent) AND preference in parallel
                    const profilePromise = apiAgent.get('app.bsky.actor.getProfile', {
                        params: { actor: repoLocal as ActorIdentifier },
                    })
                    const preferencePromise = getPostResponse(repoLocal, apiAgent)

                    const [userProfileResponse, _] = await Promise.all([profilePromise, preferencePromise])


                    if (!userProfileResponse.ok) {
                        setErrorMessage('Get Profile Failed.');
                        setIsLoading(false);
                        return
                    }


                    // userProfileのデータをセット
                    setUserProf(userProfileResponse.data);
                    setIsLoading(false);
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


    async function getPostResponse(repo: string, agent: Client) {
        try {
            const value = await getPreference(repo)

            if (!value) {
                console.error('Preference not found')
                setErrorMessage(locale.Profile_NotPublish);
                return
            }
            setMyPageDescription(value.myPage.description || '')
            setIsMyPage(value.myPage.isUseMyPage)

            // Use Slingshot to resolve PDS
            const slingshotAgent = new Client({
                handler: simpleFetchHandler({
                    service: 'https://slingshot.microcosm.blue',
                }),
            });

            const res = await (slingshotAgent as any).get('blue.microcosm.identity.resolveMiniDoc', {
                params: { identifier: repo }
            })

            if (!res.ok) {
                console.error('Failed to resolve PDS via Slingshot')
                setErrorMessage(locale.Profile_NotPublish);
                return
            }

            const pdsUrl = (res.data as any).pds;
            if (!pdsUrl) {
                console.error('PDS URL not found in Slingshot response')
                setErrorMessage(locale.Profile_NotPublish);
                return
            }

            // Create agent connected to the user's PDS
            const pdsAgent = new Client({
                handler: simpleFetchHandler({ service: pdsUrl })
            });
            setAgent(pdsAgent)
            return
        } catch (e) {
            console.error('Error fetching preference: ' + e)
            throw e
        }

        console.error('Error or MyPage not enabled')
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
                            <div className="mb-2 mx-2" style={{ animation: 'fadeIn 0.6s ease both' }}>
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
                                        <PostList agent={agent} handleEdit={null} did={repo} />
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
