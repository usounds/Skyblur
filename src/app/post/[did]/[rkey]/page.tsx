"use client"
export const runtime = 'edge';
import { Avatar } from "@/components/Avatar";
import Header from "@/components/Header";
import PostTextWithBold from "@/components/PostTextWithBold";
import { fetchServiceEndpoint } from "@/logic/HandleGetBlurRecord";
import { formatDateToLocale } from "@/logic/LocaledDatetime";
import { COLLECTION, PostData } from '@/types/types';
import { AppBskyActorDefs, AtpAgent } from '@atproto/api';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useEffect, useState } from "react";

const PostPage = () => {
    // useParams を使って、URL パラメータを取得
    const { did, rkey } = useParams();
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const [postText, setPostText] = useState<string>('')
    const [addText, setAddText] = useState("");
    const [bskyUrl, setBskyUrl] = useState("");
    const [postDate, setPostDate] = useState<string>('')
    const [errorMessage, setErrorMessage] = useState<string>('')
    const [userProf, setUserProf] = useState<AppBskyActorDefs.ProfileViewDetailed>()

    const aturi = 'at://' + did + "/" + COLLECTION + "/" + rkey

    let duplicate = false

    useEffect(() => {
        if (did && rkey) {

            if (duplicate) return
            // eslint-disable-next-line react-hooks/exhaustive-deps
            duplicate = true

            const fetchRecord = async () => {


                try {
                    let repo = Array.isArray(did) ? did[0] : did; // 配列なら最初の要素を使う
                    repo = repo.replace(/%3A/g, ':');
                    const rkeyParam = Array.isArray(rkey) ? rkey[0] : rkey; // 配列なら最初の要素を使う
                    setIsLoading(true);
                    setErrorMessage('')

                    const pdsUrl = await fetchServiceEndpoint(repo)

                    const pdsAgent = new AtpAgent({
                        service: pdsUrl || ''
                    })

                    const apiAgent = new AtpAgent({
                        service: "https://api.bsky.app"
                    })

                    try {
                        // getProfileとgetRecordを並行して呼び出す
                        const [userProfileResponse, postResponse] = await Promise.all([
                            apiAgent.getProfile({ actor: repo }),
                            pdsAgent.com.atproto.repo.getRecord({
                                repo: repo,
                                collection: COLLECTION,
                                rkey: rkeyParam,
                            }),
                        ]);

                        // userProfileのデータをセット
                        setUserProf(userProfileResponse.data);

                        // postDataのデータをセット
                        const postData: PostData = postResponse.data.value as PostData;


                        const tempPostText = postData.text

                        //if(validateBrackets(postData.text)) tempPostText = tempPostText.replace(/[\[\]]/g, '')

                        setPostText(tempPostText);
                        setAddText(postData.additional);
                        setPostDate(formatDateToLocale(postData.createdAt));

                        const convertedUri = postData.uri.replace('at://did:', 'https://bsky.app/profile/did:').replace('/app.bsky.feed.post/', '/post/');
                        setBskyUrl(convertedUri)
                        setIsLoading(false); // ローディング状態を終了
                    } catch (e) {
                        // エラーハンドリング
                        setErrorMessage('エラーが発生しました / Error Ocurred :' + e);
                        setIsLoading(false); // ローディング状態を終了
                    }
                } catch (err) {
                    console.error(err);
                    setErrorMessage('エラーが発生しました / Error Ocurred :' + err)
                } finally {
                    setIsLoading(false);
                }
            };

            fetchRecord();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [did, rkey]); // did または rkey が変更された場合に再実行


    return (
        <>
            <Header />
            <link rel="alternate" href={aturi} />

            <div className="mx-auto max-w-screen-sm px-4 md:px-8 mt-8 text-gray-800">
                <div className="mx-auto rounded-lg">
                    {userProf &&
                        <Avatar userProf={userProf} />
                    }

                    {isLoading ?
                        <>
                            <span className="animate-spin inline-block size-4 mr-2 border-[3px] border-current border-t-transparent text-gray-700 rounded-full" role="status" aria-label="loading">
                                <span className="sr-only">Loading...</span>
                            </span>
                            読み込み中です... / Now Loading...
                        </>
                        :
                        <>
                            {!errorMessage &&
                                <div className="border rounded-lg p-2 border-gray-300 max-w-screen-sm">
                                    <div className="overflow-hidden break-words">
                                        <PostTextWithBold postText={postText} isValidateBrackets={true} />
                                    </div>
                                    {addText &&
                                        <div className="mt-2">
                                            <PostTextWithBold postText={addText} isValidateBrackets={false} />
                                        </div>
                                    }

                                    <div className="flex justify-between items-center mt-2">
                                        <div className="text-sm text-gray-400">{postDate}</div>
                                        <div className="flex gap-2">
                                            <a className="text-sm text-gray-500 mx-2" href={bskyUrl} target="_blank">
                                                <Image
                                                    src="https://backet.skyblur.uk/bluesky-brands-solid.svg" // public フォルダ内のファイルは / からの相対パスで指定
                                                    alt="Trash Icon"
                                                    width={20} // 必要に応じて幅を指定
                                                    height={20} // 必要に応じて高さを指定
                                                />
                                            </a>
                                        </div>
                                    </div>

                                </div>
                            }
                        </>
                    }
                    {errorMessage &&
                        <div className="whitespace-pre-wrap break-words text-red-800">
                            {errorMessage}
                        </div>
                    }
                </div>
            </div>
        </>
    );
};

export default PostPage;
