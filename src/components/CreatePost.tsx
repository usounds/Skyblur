"use client"
import { useState } from "react";
import { Agent, RichText, AppBskyFeedPost, AppBskyActorDefs } from '@atproto/api'
import { TID } from '@atproto/common-web'
import AutoResizeTextArea from "./AutoResizeTextArea"
import Link from 'next/link';
import twitterText from 'twitter-text';
import { COLLECTION } from "@/types/types"
import {franc} from 'franc';
const iso6393to1 = require('iso-639-3-to-1');

type CreatePostProps = {
    agent: Agent;
    locale: any,
    did: string,
    userProf: AppBskyActorDefs.ProfileViewDetailed
    setMode: (value: string) => void;
};

export const CreatePostForm: React.FC<CreatePostProps> = ({
    agent,
    locale,
    did,
    userProf,
    setMode
}) => {
    const [postText, setPostTest] = useState("");
    const [postTextForRecord, setPostTextForRecord] = useState("");
    const [postTextBlur, setPostTextBlur] = useState("");
    const [warning, setWarning] = useState("");
    const [addText, setAddText] = useState("");
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const [appUrl, setAppUrl] = useState("");
    const [simpleMode, setSimpleMode] = useState<boolean>(false)

    function detectLanguage(text: string): string {
        // francを使用してテキストの言語を検出
        const lang3 = franc(text);

        console.log(lang3)
      
        // 3文字の言語コードを2文字のコードに変換。
        // 未対応の場合は 現在の表示言語 を返す
        const lang2 = iso6393to1(lang3) || locale.CreatePost_Lang;
      
        return lang2;
      }

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
        

        // 状態を更新
        setPostTest(text)
        setPostTextForRecord(postTextLocal);
        setPostTextBlur(blurredText);

        if (validateBrackets(text)) {
            setWarning(locale.CreatePost_ErrorDuplicateBranket)
            return
        }
        setWarning('')

    };

    function validateBrackets(input: string):boolean  {
        let insideBracket = false; // 現在 `[` の中にいるかどうかを追跡
    
        for (let i = 0; i < input.length; i++) {
            const char = input[i];
    
            if (char === "[") {
                // すでに `[` の中にいる場合はエラー
                if (insideBracket) {
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

        if(insideBracket) return true
    
        return false; // エラーがなければ `error: false`
    }

    const handleCrearePost = async () => {
        if (!postText) return
        setIsLoading(true)
        setAppUrl('')

        const rkey = TID.nextStr()
        const url = '/post/' + did + "/" + rkey
        const tempUrl = origin + url
        const blurUri = `at://${did}/${COLLECTION}/${rkey}`

        //URLの判定
        // titleからURLを抽出
        const pattern =
            /https?:\/\/[-_.!~*\'a-zA-Z0-9;\/?:\@&=+\$,%#\u3000-\u30FE\u4E00-\u9FA0\uFF01-\uFFE3]+/g;
        const urls = postTextBlur.match(pattern);

        // URLと出現位置を保持する配列を定義
        let urlArray: { [urlKey: string]: number };
        urlArray = {};

        //URLが取得できたら、URLが出現するまでのバイト数をカウントする
        let pos = 0;

        if (urls != null) {
            for (const url of urls) {
                pos = encodeURI(postTextBlur).replace(/%../g, "*").indexOf(url);
                //URLが見つからない場合は想定外とみなし処理を行わない（正規表現で想定外の検知をしたものは処理をしない）
                if (pos >= 0) {
                    urlArray[url] = pos;
                }
            }
        }

        //投稿
        let postTextBlurLocal: string = postTextBlur;
        const rt = new RichText({ text: postTextBlurLocal });
        await rt.detectFacets(agent);


        const langs = [detectLanguage(postText)]

        const postObj: Partial<AppBskyFeedPost.Record> &
            Omit<AppBskyFeedPost.Record, 'createdAt'> = {
            $type: 'app.bsky.feed.post',
            text: rt.text,
            facets: rt.facets,
            langs: langs,
            via: 'Skyblur',
            "uk.skyblur.post.uri": blurUri
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

        const localDesc = locale.CreatePost_OGPDescription.replace("{1}", userProf.displayName);

        // OGP設定
        postObj.embed = {
            $type: 'app.bsky.embed.external',
            external: {
                uri: tempUrl,
                title: locale.CreatePost_OGPTitle,
                description: localDesc,
            },
        };

        //URLをリンク化
        Object.keys(urlArray).forEach(function (key) {
            if (typeof postObj.facets !== "undefined") {
                postObj.facets.push(
                    {
                        index: {
                            "byteStart": urlArray[key],
                            "byteEnd": urlArray[key] + key.length
                        },
                        features: [
                            {
                                "$type": "app.bsky.richtext.facet#link",
                                "uri": key
                            }
                        ]
                    }
                );
            }
        });

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
            setMode('menu')
        } else {
            console.error(ret)

        }
        setIsLoading(false)
    }

    return (
        <>
            <div className="m-3">

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
                            isEnableBrackets={!simpleMode}
                        />
                        {warning && <div className="text-red-500 my-3">{warning}</div> }
                        
                        <div className="block text-sm text-gray-600 mt-1">{postText.length}/300</div>


                        <div className='mt-2'>{locale.CreatePost_Preview}</div>
                        <div className="block text-sm text-gray-400 mt-1">{locale.CreatePost_PreviewDescription}</div>

                        <AutoResizeTextArea
                            text={postTextBlur}
                            setPostText={setPostText}
                            disabled={true}
                            locale={locale}
                            placeHolder={locale.CreatePost_PreviewPlaceHolder}
                            max={10000}
                            isEnableBrackets={false}
                        />

                        <div className='mt-2'>{locale.CreatePost_Additional}</div>
                        <div className="block text-sm text-gray-400 mt-1">{locale.CreatePost_AdditionalDescription}</div>
                        <AutoResizeTextArea
                            text={addText}
                            setPostText={setAddText}
                            disabled={false}
                            locale={locale}
                            placeHolder={locale.CreatePost_AdditionalPlaceHolder}
                            max={10000}
                            isEnableBrackets={false}
                        />

                        <div className="block text-sm text-gray-600 mt-1">{addText.length}/10000</div>

                        <div className="flex justify-center gap-4 mb-8">
                            {warning ? <div className="text-red-500">{warning}</div> :
                                <button onClick={handleCrearePost} disabled={isLoading} className="disabled:bg-gray-200 mt-3 relative z-0 h-12 rounded-full bg-blue-500 px-6 text-neutral-50 after:absolute after:left-0 after:top-0 after:-z-10 after:h-full after:w-full after:rounded-full hover:after:scale-x-125 hover:after:scale-y-150 hover:after:opacity-0 hover:after:transition hover:after:duration-500">{locale.CreatePost_CreateButton}</button>
                            }
                        </div>
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