"use client"
import { useState } from "react";
import { Agent, RichText, AppBskyFeedPost, AppBskyActorDefs } from '@atproto/api'
import AutoResizeTextArea from "./AutoResizeTextArea"
import Link from 'next/link';
import twitterText from 'twitter-text';
import { COLLECTION } from "../types/types"

type CreatePostProps = {
    agent: Agent;
    locale: any,
    did: string,
    userProf: AppBskyActorDefs.ProfileViewDetailed
};

export const CreatePostForm: React.FC<CreatePostProps> = ({
    agent,
    locale,
    did,
    userProf
}) => {
    const [postText, setPostTest] = useState("");
    const [postTextForRecord, setPostTextForRecord] = useState("");
    const [postTextBlur, setPostTextBlur] = useState("");
    const [addText, setAddText] = useState("");
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const [appUrl, setAppUrl] = useState("");
    const [simpleMode, setSimpleMode] = useState<boolean>(false)

    const setPostText = (text: string) => {
        if (!text) setPostTextBlur("")
        setAppUrl('')
        let postTextLocal = text
        if (simpleMode) {
            const lines = postTextLocal.split('\n');
            // 行数が2行以上の場合にのみ処理を実行
            if (lines.length > 1) {
                postTextLocal = lines.map((line, index, lines) => {
                    // 2行目の最初に "[" を追加
                    if (index === 1) {
                        line = `[${line}`;
                    }
                    // 最後の行に "]" を追加
                    if (index === lines.length - 1) {
                        line = `${line}]`;
                    }
                    return line;
                }).join('\n');
            }
        }


        // 正規表現で [] に囲まれた部分を ○ に置換
        let blurredText = postTextLocal.replace(/\[(.*?)\]/gs, (_, match) => {
            // マッチした文字列内の改行を維持しつつ ommitChar で置換
            return match.replace(/./g, locale.CreatePost_OmmitChar);
        });


        if (blurredText.length > 200) {
            blurredText = blurredText.slice(0, 200);
        }

        console.log(blurredText)

        // 状態を更新
        setPostTest(text)
        setPostTextForRecord(postTextLocal);
        setPostTextBlur(blurredText);
    };

    function generateRkey(): string {
        // 現在の時刻をミリ秒で取得
        const timestamp = Date.now().toString(36); // 36進数で表現

        // ランダムな英数字を生成（小文字のアルファベットと数字）
        const randomChars = Math.random().toString(36).slice(2, 7); // 5文字

        // タイムスタンプとランダム文字列を組み合わせて15桁
        const rkey = (timestamp + randomChars).slice(0, 15);

        console.log("rkey:" + rkey)

        return rkey;
    }

    const getOgp = async (url: string) => {
        const response = await fetch(url || '');
        const buffer = await response.arrayBuffer();

        let resizedImage, mimeType;
        mimeType = response.headers.get("content-type") || 'image/ping';

        resizedImage = new Uint8Array(buffer);

        return {
            type: mimeType,
            image: resizedImage,
        };
    };

    const handleCrearePost = async () => {
        if (!postText) return
        setIsLoading(true)
        setAppUrl('')

        const rkey = generateRkey()
        const url = '/post/' + did + "/" + rkey
        const tempUrl = origin + url

        //投稿
        let postTextBlurLocal: string = postTextBlur;
        const rt = new RichText({ text: postTextBlurLocal });
        await rt.detectFacets(agent);

        const postObj: Partial<AppBskyFeedPost.Record> &
            Omit<AppBskyFeedPost.Record, 'createdAt'> = {
            $type: 'app.bsky.feed.post',
            text: rt.text,
            facets: rt.facets,
            langs: [locale.CreatePost_Lang],
            via: 'Skyblur',
        };

        postObj.facets = new Array(0);

        // TextEncoder を使用して UTF-8 バイト配列に変換
        const encoder = new TextEncoder();
        const postTextBytes = encoder.encode(postTextBlurLocal);
        const fixedTextBytes = encoder.encode(tempUrl);

        // バイト列を検索するためのインデックス取得
        let startIndex = -1;
        for (let i = 0; i <= postTextBytes.length - fixedTextBytes.length; i++) {
            // バイト列が一致するかを比較
            if (postTextBytes.slice(i, i + fixedTextBytes.length).every((byte, index) => byte === fixedTextBytes[index])) {
                startIndex = i;
                break;
            }
        }

        if (startIndex !== -1) {
            // 見つかった場合、その位置を byteStart として設定
            const byteStart = startIndex;

            // byteEnd は byteStart に locale.CreatePost_Fixed の長さを加算
            const byteEnd = byteStart + encodeURI(tempUrl).replace(/%../g, "*").length;

            // postObj.facets に追加するオブジェクトを作成
            postObj.facets.push(
                {
                    index: {
                        byteStart: byteStart,
                        byteEnd: byteEnd
                    },
                    features: [
                        {
                            "$type": "app.bsky.richtext.facet#link",
                            "uri": tempUrl
                        }
                    ]
                }
            );
        } else {
            console.log("指定された文字列が見つかりませんでした");
        }

        const hashTags = twitterText.extractHashtagsWithIndices(postTextBlurLocal);

        for (const obj of hashTags) {
            //ハッシュタグまでの文字列とハッシュタグが終わる文字列を取得
            const fromText = postTextBlurLocal.slice(0, obj.indices[0]);
            const toText = postTextBlurLocal.slice(0, obj.indices[1]);

            //マルチバイト対応
            const fromIndex = encodeURI(fromText).replace(/%../g, "*").length;
            const toIndex = encodeURI(toText).replace(/%../g, "*").length;

            postObj.facets.push(
                {
                    index: {
                        "byteStart": fromIndex,
                        "byteEnd": toIndex
                    },
                    features: [
                        {
                            "$type": "app.bsky.richtext.facet#tag",
                            "tag": obj.hashtag
                        }
                    ]
                }
            );
        }

        console.log(userProf)
        let og = await getOgp("https://blursky.usounds.work/skyblur.png");
        const uploadedImage = await agent.uploadBlob(og.image, {
            encoding: og.type,
        });
        const localDesc = locale.CreatePost_OGPDescription.replace("{1}", userProf.handle);


        // 投稿オブジェクトに画像を追加
        postObj.embed = {
            $type: 'app.bsky.embed.external',
            external: {
                uri: tempUrl,
                thumb: {
                    $type: 'blob',
                    ref: {
                        $link: uploadedImage.data.blob.ref.toString(),
                    },
                    mimeType: uploadedImage.data.blob.mimeType,
                    size: uploadedImage.data.blob.size,
                },
                title: userProf.displayName + ' | Skyblur',
                description: localDesc,
            },
        };

        const result = await agent.post(postObj);

        const postObject = {
            repo: did,
            collection: COLLECTION,
            rkey: rkey,
            record: {
                uri: result.uri,
                text: postTextForRecord,
                additional: addText,
                createdAt: new Date().toISOString(),
            },
        }

        const ret = await agent.com.atproto.repo.putRecord(postObject)
        if (ret.success) {
            const convertedUri = result.uri.replace('at://did:', 'https://bsky.app/profile/did:').replace('/app.bsky.feed.post/', '/post/');
            setAppUrl(convertedUri)
            setPostTest('')
            setAddText('')
        } else {
            console.error(ret)

        }
        setIsLoading(false)
    }

    return (
        <>
            <div className="">

                {(!appUrl) &&
                    <>

                        <label className="">{locale.CreatePost_Post}</label>

                        <div className="flex my-1">
                            <input type="checkbox" checked={simpleMode} onChange={(event) => {
                                setSimpleMode(event.target.checked);
                                setPostText(''); // setPostTextは状態変更のために呼び出す
                            }}
                                className="shrink-0 mt-0.5 border-gray-200 rounded text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-800 dark:border-neutral-700 dark:checked:bg-blue-500 dark:checked:border-blue-500 dark:focus:ring-offset-gray-800" id="hs-checked-checkbox" />
                            <label htmlFor="hs-checked-checkbox" className="text-sm mt-0.5 text-gray-500 ms-3">{locale.CreatePost_SimpleMode}</label>
                        </div>

                        {simpleMode ?
                            <div className="block text-sm text-gray-400 mt-1">{locale.CreatePost_PostSimpleModeDescription}</div>
                            :
                            <div className="block text-sm text-gray-400 mt-1">{locale.CreatePost_PostComplexDescription}</div>
                        }
                        <AutoResizeTextArea
                            text={postText}
                            setPostText={setPostText}
                            disabled={false}
                            locale={locale}
                            placeHolder={locale.CreatePost_PostPlaceHolder}
                            max={300}
                        />
                        <div className="block text-sm text-gray-600 mt-1">{postText.length}/300</div>
                        <div className='mt-2'>{locale.CreatePost_Additional}</div>
                        <div className="block text-sm text-gray-400 mt-1">{locale.CreatePost_AdditionalDescription}</div>
                        <AutoResizeTextArea
                            text={addText}
                            setPostText={setAddText}
                            disabled={false}
                            locale={locale}
                            placeHolder={locale.CreatePost_AdditionalPlaceHolder}
                            max={10000}
                        />

                        <div className="block text-sm text-gray-600 mt-1">{addText.length}/10000</div>


                        <div className='mt-2'>{locale.CreatePost_Preview}</div>
                        <div className="block text-sm text-gray-400 mt-1">{locale.CreatePost_PreviewDescription}</div>

                        <AutoResizeTextArea
                            text={postTextBlur}
                            setPostText={setPostText}
                            disabled={true}
                            locale={locale}
                            placeHolder={locale.CreatePost_PreviewPlaceHolder}
                            max={10000}
                        />


                        <div className='mt-2'>{locale.CreatePost_Create}</div>
                        <div className="block text-sm text-gray-400 mt-1">{locale.CreatePost_CreateDescription}</div>
                        <button
                            onClick={handleCrearePost}
                            disabled={isLoading}
                            className="rounded-lg mt-2 w-full bg-blue-800 px-8 py-3 text-center text-sm text-white outline-none ring-blue-300 transition duration-100 hover:bg-blue-700 focus-visible:ring active:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-600 md:text-base flex items-center justify-center"
                        >
                            {locale.CreatePost_CreateButton}
                        </button>
                    </>
                }

                {appUrl &&
                    <>
                        <label className="block text-sm text-gray-600 mt-1">{locale.CreatePost_Success}</label>

                        <div className="overflow-hidden break-words mt-2 text-center">
                            <Link href={appUrl} target='_blank' className="flex items-center justify-center space-x-2">
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
            </div>
        </>
    )
}