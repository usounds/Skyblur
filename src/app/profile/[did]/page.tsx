"use client"
export const runtime = 'edge';
import { Avatar } from "@/components/Avatar";
import Header from "@/components/Header";
import { PostList } from "@/components/PostList";
import PostLoading from "@/components/PostLoading";
import { fetchServiceEndpoint } from "@/logic/HandleBluesky";
import { useAtpAgentStore } from "@/state/AtpAgent";
import { useLocaleStore } from "@/state/Locale";
import { customTheme } from '@/types/types';
import { getPreference } from "@/logic/HandleBluesky";
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
    const locale = useLocaleStore((state) => state.localeData);
    const apiAgent = useAtpAgentStore((state) => state.publicAgent);
    const searchParams = useSearchParams();
    const [agent, setAgent] = useState<AtpAgent | null>(null)
    const q = searchParams.get('q');
    const [repo, setRepo] = useState<string>('')
    const pdsAgent = new AtpAgent({
      service: 'https://bsky.social'
    })

    useEffect(() => {
        if (did) {
            const fetchRecord = async () => {

                try {
                    let repoLocal = Array.isArray(did) ? did[0] : did; // 配列なら最初の要素を使う
                    repoLocal = repoLocal.replace(/%3A/g, ':');
                    setRepo(repoLocal)
                    setIsLoading(true);
                    setErrorMessage('')

                    try {
                        // getProfileとgetRecordを並行して呼び出す
                        const [userProfileResponse, postResponse] = await Promise.all([
                            apiAgent.getProfile({ actor: repoLocal }),
                            getPostResponse(repoLocal),
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


    async function getPostResponse(repo: string) {
        try {
            const value =await getPreference(pdsAgent,repo)
            if (value.isUseMyPage) {
                setAgent(pdsAgent)
                return
            }

        } catch (e) {
            console.error('エラーだよ'+e)

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
                <div className="mx-auto max-w-screen-sm px-4 md:px-8 mt-8 text-gray-800">
                    <div className="mx-auto rounded-lg">
                        {userProf &&
                            <Avatar userProf={userProf} />
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
                                            <PostList agent={agent} handleEdit={null} did={repo}/>
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
                            <div className="whitespace-pre-wrap break-words text-red-800">
                                {errorMessage}
                            </div>
                        }
                    </div>
                </div >
            </ThemeProvider>
        </>
    );
};

export default PostPage;
