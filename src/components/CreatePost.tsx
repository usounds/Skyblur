"use client"
import AutoResizeTextArea from "@/components/AutoResizeTextArea";
import { RestoreTempPost } from "@/components/RestoreTempPost";
import { useAtpAgentStore } from "@/state/AtpAgent";
import { useLocaleStore } from "@/state/Locale";
import { useTempPostStore } from "@/state/TempPost";
import { COLLECTION, PostListItem } from "@/types/types";
import { AppBskyFeedPost, RichText } from '@atproto/api';
import { TID } from '@atproto/common-web';
import { franc } from 'franc';
import { Button, Checkbox } from 'reablocks';
import { useEffect, useState } from "react";
import twitterText from 'twitter-text';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const iso6393to1 = require('iso-639-3-to-1');

type CreatePostProps = {
    setMode: (value: string) => void;
    prevBlur?: PostListItem
};

export const CreatePostForm: React.FC<CreatePostProps> = ({
    setMode,
    prevBlur
}) => {
    const [postText, setPostTest] = useState("");
    const [postTextForRecord, setPostTextForRecord] = useState("");
    const [postTextBlur, setPostTextBlur] = useState("");
    const [warning, setWarning] = useState("");
    const [addText, setAddText] = useState("");
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const [appUrl, setAppUrl] = useState("");
    const [simpleMode, setSimpleMode] = useState<boolean>(false)
    const [isIncludeFullBranket, setIsIncludeFullBranket] = useState<boolean>(false)
    const agent = useAtpAgentStore((state) => state.agent);
    const locale = useLocaleStore((state) => state.localeData);
    const did = useAtpAgentStore((state) => state.did);
    const setTempText = useTempPostStore((state) => state.setText);
    const setTempAdditional = useTempPostStore((state) => state.setAdditional);
    const setTempSimpleMode = useTempPostStore((state) => state.setSimpleMode);
    const tempText = useTempPostStore((state) => state.text);
    const tempAdditional = useTempPostStore((state) => state.additional);
    const tempSimpleMode = useTempPostStore((state) => state.simpleMode);
    const [isTempRestore, setIsTempRestore] = useState<boolean>(false)

    function detectLanguage(text: string): string {
        // francを使用してテキストの言語を検出
        const lang3 = franc(text);

        console.log(lang3)

        // 3文字の言語コードを2文字のコードに変換。
        // 未対応の場合は 現在の表示言語 を返す
        const lang2 = iso6393to1(lang3) || locale.CreatePost_Lang;

        return lang2;
    }

    function containsFullWidthBrackets(input: string): boolean {
        const fullWidthBracketsPattern = /［|］/;
        return fullWidthBracketsPattern.test(input);
    }

    function areBracketsUnbalanced(input: string): boolean {
        let openBracketsCount = 0;
        let closeBracketsCount = 0;

        for (const char of input) {
            if (char === '[') {
                openBracketsCount++;
            } else if (char === ']') {
                closeBracketsCount++;
            }
        }

        return openBracketsCount !== closeBracketsCount;
    }

    function convertFullWidthToHalfWidthBrackets(): void {
        setPostText(postText.replace(/［/g, '[').replace(/］/g, ']'))
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
        const blurredText = postTextLocal.replace(/\[(.*?)\]/gs, (_, match) => {
            // マッチした文字列内の改行を維持しつつ ommitChar で置換
            return match.replace(/./g, locale.CreatePost_OmmitChar);
        });


        // 状態を更新
        setPostTest(text)
        setPostTextForRecord(postTextLocal);
        setPostTextBlur(blurredText);

        setTempText(text)

        setIsIncludeFullBranket(containsFullWidthBrackets(text))


        if (validateBrackets(text)) {
            setWarning(locale.CreatePost_ErrorDuplicateBranket)
            return
        }

        if (areBracketsUnbalanced(text)) {
            setWarning(locale.CreatePost_BracketsUnbalanced)
            return
        }

        setWarning('')

    };

    function validateBrackets(input: string): boolean {
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

        if (insideBracket) return true

        return false; // エラーがなければ `error: false`
    }

    const handleCrearePost = async () => {
        if (!agent) {
            console.error("未ログインです")
            return
        }
        if (!postText) return
        setIsLoading(true)
        setAppUrl('')

        let localPrevPostAturi


        let rkey = TID.nextStr()
        if (prevBlur && prevBlur.blurATUri) {
            const regex = /\/([^/]+)$/;
            const match = prevBlur.blurATUri.match(regex);
            if (match) {
                rkey = match[1];
            }

            localPrevPostAturi = prevBlur.blur.uri
        }

        const url = '/post/' + did + "/" + rkey
        const tempUrl = origin + url
        const blurUri = `at://${did}/${COLLECTION}/${rkey}`
        if (!prevBlur) {
            //URLの判定
            // titleからURLを抽出
            const pattern =
                /https?:\/\/[-_.!~*\'a-zA-Z0-9;\/?:\@&=+\$,%#\u3000-\u30FE\u4E00-\u9FA0\uFF01-\uFFE3]+/g;
            const urls = postTextBlur.match(pattern);

            // URLと出現位置を保持する配列を定義
            const urlArray: { [urlKey: string]: number } = {};

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
            const postTextBlurLocal: string = postTextBlur;
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

            const localDesc = locale.CreatePost_OGPDescription

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

            localPrevPostAturi = result.uri


        }

        const postObject = {
            repo: did,
            collection: COLLECTION,
            rkey: rkey,
            record: {
                uri: localPrevPostAturi,
                text: postTextForRecord,
                additional: addText,
                createdAt: prevBlur?.blur.createdAt || new Date().toISOString(),
            },
        }

        const ret = await agent.com.atproto.repo.putRecord(postObject)
        if (ret.success) {
            const convertedUri = "completed";
            setAppUrl(convertedUri)
            setPostTest('')
            setAddText('')
            handleTempDelete()
            setMode('menu')
        } else {
            console.error(ret)

        }
        setIsLoading(false)
    }

    useEffect(() => {


        if (prevBlur) {
            setPostText(prevBlur.blur.text)
            setAddText(prevBlur.blur.additional)
        } else if (tempText || tempAdditional) {
            setIsTempRestore(true)

        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [did, prevBlur]); // Make sure to use the correct second dependency


    const handleCheckboxChange = (isChecked: boolean) => {
        setSimpleMode(isChecked);
        setTempSimpleMode(isChecked);
        setPostText(''); // テキストを空にします
    };

    const handleAddText = (addText: string) => {
        setAddText(addText);
        setTempAdditional(addText);
    };

    const handleTempDelete = () => {
        setTempText('')
        setTempAdditional('')
        setTempSimpleMode(false)
    };

    const handleTempApply = () => {
        console.log('handleTempApply')
        setPostText(tempText);
        setAddText(tempAdditional)
        setSimpleMode(tempSimpleMode)
    };

    const handleModalClose = () => {
        setIsTempRestore(false)
    };


    return (
        <>
            <div className="m-3">

                {isTempRestore &&
                    <RestoreTempPost content={tempText} onApply={handleTempApply} onClose={handleModalClose} />
                }

                {(!appUrl) &&
                    <>

                        <label className="">{locale.CreatePost_Post}</label>

                        <div className="flex my-1">
                            <p>      <Checkbox
                                checked={simpleMode}
                                onChange={handleCheckboxChange} // Boolean を渡します
                                label={locale.CreatePost_SimpleMode}
                            /></p>
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
                            error={warning}
                        />
                        <div className="flex justify-center gap-4 mb-8">
                            {isIncludeFullBranket &&
                                <button onClick={convertFullWidthToHalfWidthBrackets} disabled={isLoading} className="disabled:bg-gray-200 mt-3 relative z-0 h-12 rounded-full bg-blue-500 px-6 text-neutral-50 after:absolute after:left-0 after:top-0 after:-z-10 after:h-full after:w-full after:rounded-full hover:after:scale-x-125 hover:after:scale-y-150 hover:after:opacity-0 hover:after:transition hover:after:duration-500">{locale.CreatePost_BracketFromFullToHalf}</button>
                            }
                        </div>

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
                            setPostText={handleAddText}
                            disabled={false}
                            locale={locale}
                            placeHolder={locale.CreatePost_AdditionalPlaceHolder}
                            max={10000}
                            isEnableBrackets={false}
                        />

                        <div className="block text-sm text-gray-600 mt-1">{addText.length}/10000</div>

                        <div className="flex justify-center gap-4 mb-8">
                            {!warning &&

                                <Button color="primary" className="text-white text-base font-normal" onClick={handleCrearePost} disabled={isLoading || postText.length === 0} >
                                    {prevBlur ?
                                        <>{locale.CreatePost_UpdateButton}</>
                                        :
                                        <>{locale.CreatePost_CreateButton}</>
                                    }
                                </Button>
                            }
                        </div>
                    </>
                }

            </div>
        </>
    )
}