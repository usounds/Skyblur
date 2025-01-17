"use client"
export const runtime = 'edge';
import { Avatar } from "@/components/Avatar";
import Header from "@/components/Header";
import { PostList } from "@/components/PostList";
import PostLoading from "@/components/PostLoading";
import { fetchServiceEndpoint, getPreference } from "@/logic/HandleBluesky";
import { useAtpAgentStore } from "@/state/AtpAgent";
import { useLocaleStore } from "@/state/Locale";
import { customTheme } from '@/types/types';
import { AppBskyActorDefs, AtpAgent } from '@atproto/api';
import Head from 'next/head';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Button, ThemeProvider, extendTheme, theme } from 'reablocks';
import { useEffect, useState } from "react";

const PostPage = () => {
    const { did } = useParams();
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const [errorMessage, setErrorMessage] = useState<string>('')
    const [userProf, setUserProf] = useState<AppBskyActorDefs.ProfileViewDetailed>()
    const [myPageDescription, setMyPageDescription] = useState<string>('')
    const locale = useLocaleStore((state) => state.localeData);
    const apiAgent = useAtpAgentStore((state) => state.publicAgent);
    const searchParams = useSearchParams();
    const [agent, setAgent] = useState<AtpAgent | null>(null)
    const q = searchParams.get('q');
    const [repo, setRepo] = useState<string>('')
    const [isMyPage, setIsMyPage] = useState<boolean>(false)

    useEffect(() => {
        if (did) {
            const fetchRecord = async () => {



                try {
                    let repoLocal = Array.isArray(did) ? did[0] : did; // 配列なら最初の要素を使う
                    repoLocal = repoLocal.replace(/%3A/g, ':');
                    const pdsUrl = await fetchServiceEndpoint(repoLocal)
                    const pdsAgent = new AtpAgent({
                        service: pdsUrl || ''
                    })
    
                    setRepo(repoLocal)
                    setIsLoading(true);
                    setErrorMessage('')

                    try {
                        // getProfileとgetRecordを並行して呼び出す
                        const [userProfileResponse, postResponse] = await Promise.all([
                            apiAgent.getProfile({ actor: repoLocal }),
                            getPostResponse(repoLocal,pdsAgent),
                        ]);

                        // userProfileのデータをセット
                        setUserProf(userProfileResponse.data);
                        setIsLoading(false); // ローディング状態を終了
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
    }, [did]); // did または rkey が変更された場合に再実行


    async function getPostResponse(repo: string, pdsAgent:AtpAgent) {
        try {
            const value = await getPreference(pdsAgent, repo,)
            if (value.myPage.isUseMyPage) {
                setMyPageDescription(value.myPage.description)
                setIsMyPage(value.myPage.isUseMyPage)
                setAgent(pdsAgent)
                return
            }

        } catch (e) {
            console.error('エラーだよ' + e)

        }

        console.error('エラーだよ')
        setErrorMessage(locale.Profile_NotPublish);

    }

    return (
        <>
            <Head>
                <meta name="robots" content="noindex, nofollow" />
            </Head>
            <Header />

            <ThemeProvider theme={extendTheme(theme, customTheme)}>
                <div className="mx-auto max-w-screen-sm md:mt-6 mt-3 mx-2 text-gray-800">
                    <div className="mx-auto rounded-lg">
                        {userProf &&
                            <div className="mb-2 mx-2">
                                <Avatar userProf={userProf} href={isMyPage ? `https://${window.location.hostname}/profile/${userProf.did}` : `https://bsky.app/profile/${userProf.did}`} target={isMyPage ? `` : `_blank`} />
                            </div>
                        }


                        {myPageDescription &&
                            <div className="whitespace-pre-wrap break-words text-gray-600 mx-3 my-4">
                                {myPageDescription}
                            </div>
                        }

                        {isLoading ?
                            <div className="">
                                <PostLoading />
                            </div>
                            :
                            <>
                                {!errorMessage &&
                                    <>

                                        {agent &&
                                            <div className="mx-auto max-w-screen-sm">
                                                <PostList agent={agent} handleEdit={null} did={repo} />
                                            </div>
                                        }

                                        {(q == 'preview' && agent) &&
                                            <>
                                                <div className="flex justify-center mt-10">
                                                    <Link href="/">
                                                        <Button color="secondary" size="large" className="text-white text-base font-normal" >{locale.Menu_Back}</Button>
                                                    </Link>
                                                </div>
                                            </>
                                        }

                                    </>
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
                </div >
            </ThemeProvider>
        </>
    );
};

export default PostPage;
