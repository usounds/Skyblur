"use client"
export const runtime = 'edge';
import { useParams } from 'next/navigation';
import { useState, useEffect } from "react";
import Image from "next/image";
import { AtpAgent, AppBskyActorDefs } from '@atproto/api'
import { DIDResponse, Service, PostData, COLLECTION } from '../../../../types/types'
import PostTextWithBold from "../../../../components/PostTextWithBold"
import { Avatar } from "../../../../components/Avatar"
import LanguageSelect from "../../../../components/LanguageSelect"
import ja from "../../../../locales/ja"
import en from "../../../../locales/en"

import Link from 'next/link';

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
    const [locale, setLocale] = useState(ja)
    const [selectedLocale, setSelectedLocale] = useState<string>('ja');
    const [isIncorrectBrackets, setIsIncorrectBrackets] = useState<boolean>(false)

    let publicAgent: AtpAgent

    const publicAgent2 = new AtpAgent({
        service: "https://api.bsky.app"
    })


    function validateBrackets(input: string): boolean {
        let insideBracket = false; // 現在 `[` の中にいるかどうかを追跡

        for (let i = 0; i < input.length; i++) {
            const char = input[i];
            console.log(char)

            if (char === "[") {
                // すでに `[` の中にいる場合はエラー
                if (insideBracket) {
                    console.log('char')
                    return true;
                }
                insideBracket = true; // `[` の中に入る
            } else if (char === "]") {
                // `[` の中にいる場合は終了
                if (insideBracket) {
                    insideBracket = false;
                }
            }
        }

        if (insideBracket) return true

        return false; // エラーがなければ `error: false`
    }


    const changeLocale = (localeParam: string) => {
        // ここで実際のロジック（例: 言語の変更など）を実行します
        console.log(`Locale changed to: ${locale}`);
        setSelectedLocale(localeParam)
        window.localStorage.setItem('preference.locale', localeParam)
        if (localeParam == 'ja') setLocale(ja)
        if (localeParam == 'en') setLocale(en)
    };

    const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newLocale = event.target.value;
        setSelectedLocale(newLocale); // 選択された値をステートに設定
        changeLocale(newLocale); // changeLocale を呼び出す
    };


    const fetchServiceEndpoint = async (did: string) => {
        const encodedDid = encodeURIComponent(did); // URLエンコード
        const didUrl = `https://dev.uniresolver.io/1.0/identifiers/${encodedDid}`;

        try {
            const response = await fetch(didUrl);
            if (!response.ok) {
                throw new Error('Failed to fetch DID document');
            }

            const data: DIDResponse = await response.json(); // レスポンスの全体を型定義
            const didDocument = data.didDocument; // didDocument部分を取り出す

            // didDocument.serviceが存在するかチェック
            const service = didDocument.service?.find((s: Service) => s.id === '#atproto_pds');

            if (service && service.serviceEndpoint) {
                console.log('Service Endpoint:', service.serviceEndpoint);
                return service.serviceEndpoint;
            } else {
                throw new Error('Service with id #atproto_pds not found or no service endpoint available');
            }
        } catch (error) {
            console.error('Error fetching service endpoint:', error);
        }
    };

    const formatDateToLocale = (dateString: string) => {
        const date = new Date(dateString);
        const userLocale = navigator.language; // ブラウザのロケールを取得

        return new Intl.DateTimeFormat(userLocale, {
            year: "numeric",
            month: "numeric",
            day: "numeric",
            hour: "numeric",
            minute: "numeric",
            second: "numeric",
            hour12: false, // 24時間表示
        }).format(date);
    };

    useEffect(() => {
        if (did && rkey) {
            const localLocale = window.localStorage.getItem('preference.locale')

            if (localLocale) changeLocale(localLocale)

            const fetchRecord = async () => {


                try {
                    let repo = Array.isArray(did) ? did[0] : did; // 配列なら最初の要素を使う
                    repo = repo.replace(/%3A/g, ':');
                    const rkeyParam = Array.isArray(rkey) ? rkey[0] : rkey; // 配列なら最初の要素を使う
                    setIsLoading(true);
                    setErrorMessage('')

                    const pdsUrl = await fetchServiceEndpoint(repo)

                    publicAgent = new AtpAgent({
                        service: pdsUrl || ''
                    })


                    try {
                        // getProfileとgetRecordを並行して呼び出す
                        const [userProfileResponse, postResponse] = await Promise.all([
                            publicAgent2.getProfile({ actor: repo }),
                            publicAgent.com.atproto.repo.getRecord({
                                repo: repo,
                                collection: COLLECTION,
                                rkey: rkeyParam,
                            }),
                        ]);

                        // userProfileのデータをセット
                        setUserProf(userProfileResponse.data);

                        // postDataのデータをセット
                        const postData: PostData = postResponse.data.value as PostData;


                        let tempPostText = postData.text

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
    }, [did, rkey]); // did または rkey が変更された場合に再実行


    return (
        <>

            <div className="flex flex-wrap w-full text-sm py-2 bg-neutral-800">
                <nav className="px-4 md:px-8 w-full mx-auto flex justify-between items-center flex-row">
                    <Link href={"/"} className="text-xl font-semibold text-white">
                        Skyblur
                    </Link>
                    <div className="flex flex-row items-center gap-2 text-gray-800 mt-2 sm:mt-0">
                        <Link href={"/termofuse"} className="flex-none text-sm font-semibold text-white mr-2">
                            {locale.Menu_TermOfUse}
                        </Link>
                        <LanguageSelect
                            selectedLocale={selectedLocale}
                            onChange={(locale) => handleChange({ target: { value: locale } } as React.ChangeEvent<HTMLSelectElement>)}
                        />
                    </div>
                </nav>
            </div>

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
                                        <PostTextWithBold postText={postText} />
                                    </div>
                                    {addText &&
                                        <div className="overflow-hidden break-words mt-2">
                                            {addText}
                                        </div>
                                    }

                                    <div className="flex justify-between items-center mt-2">
                                        <div className="text-sm text-gray-400">{postDate}</div>
                                        <div className="flex gap-2">
                                            <a className="text-sm text-gray-500 mx-2" href={bskyUrl} target="_blank">
                                                <Image
                                                    src="/bluesky-brands-solid.svg" // public フォルダ内のファイルは / からの相対パスで指定
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
