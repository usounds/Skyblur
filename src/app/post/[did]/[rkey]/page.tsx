"use client"
export const runtime = 'edge';
import { useParams } from 'next/navigation';
import { useState, useEffect } from "react";
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

    let publicAgent: AtpAgent

    const publicAgent2 = new AtpAgent({
        service: "https://api.bsky.app"
    })

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
                        setPostText(postData.text);
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

            <div className="mx-auto max-w-screen-sm px-4 md:px-8 mt-4 text-gray-800">
                <div className="mx-auto max-w-screen-md rounded-lg">
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
                            <p className="text-sm text-gray-500">{postDate}</p>
                            <div className="border rounded-lg p-2 border-gray-300">
                                <div className="overflow-hidden break-words">
                                    <PostTextWithBold postText={postText} />
                                </div>
                                {addText &&
                                    <div className="overflow-hidden break-words mt-2">
                                        {addText}
                                    </div>
                                }
                            </div>

                            <div className="overflow-hidden break-words mt-2 text-center">
                                <Link href={bskyUrl} target='_blank' className="flex items-center justify-center space-x-2">
                                    <span>{locale.CreatePost_LinkToBsky}</span>
                                    <svg
                                        width="20px"
                                        height="20px"
                                        viewBox="0 0 800 800"
                                        version="1.1"
                                        xmlns="http://www.w3.org/2000/svg"
                                        xmlnsXlink="http://www.w3.org/1999/xlink"
                                        xmlSpace="preserve"
                                        style={{
                                            fillRule: 'evenodd',
                                            clipRule: 'evenodd',
                                            strokeLinecap: 'round',
                                            strokeLinejoin: 'round',
                                            strokeMiterlimit: 1
                                        }}
                                    >
                                        <g transform="matrix(1,0,0,1,-235,-1950)">
                                            <g transform="matrix(2.02015,0,0,2.02017,-51.8034,1393.69)">
                                                <rect x="142.327" y="275.741" width="396.011" height="396.011" style={{ fill: 'none' }} />
                                                <g transform="matrix(0.495014,0,0,0.495007,3.15989,-102.548)">
                                                    <path
                                                        d="M687.28,980.293L406.378,980.293L406.378,1438.97L865.059,1438.97L865.059,1159.34"
                                                        style={{ fill: 'none', stroke: 'black', strokeWidth: '22.22px' }}
                                                    />
                                                </g>
                                                <g transform="matrix(0.145129,0.145127,-0.145129,0.145127,656.851,-26.082)">
                                                    <path
                                                        d="M519.133,2352.46L519.133,2855.01L744,2855.01L744,2352.46L1108.68,2352.46L631.567,1875.35L154.455,2352.46L519.133,2352.46Z"
                                                        style={{ fill: 'none', stroke: 'black', strokeWidth: '53.6px' }}
                                                    />
                                                </g>
                                            </g>
                                        </g>
                                    </svg>
                                </Link>
                            </div>
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
