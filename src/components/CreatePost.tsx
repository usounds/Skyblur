"use client"
import AutoResizeTextArea from "@/components/AutoResizeTextArea";
import { ReplyList } from "@/components/ReplyList";
import { RestoreTempPost } from "@/components/RestoreTempPost";
import { transformUrl } from "@/logic/HandleBluesky";
import { formatDateToLocale } from "@/logic/LocaledDatetime";
import { useAtpAgentStore } from "@/state/AtpAgent";
import { useLocaleStore } from "@/state/Locale";
import { useTempPostStore } from "@/state/TempPost";
import { SKYBLUR_POST_COLLECTION, VISIBILITY_PUBLIC, VISIBILITY_PASSWORD, PostListItem, PostView } from "@/types/types";
import { AppBskyFeedPost, RichText } from '@atproto/api';
import { TID } from '@atproto/common-web';
import DOMPurify from 'dompurify';
import { franc } from 'franc';
import { Button, IconButton, Toggle, useNotification, Input } from 'reablocks';
import { useEffect, useState } from "react";
import twitterText from 'twitter-text';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const iso6393to1 = require('iso-639-3-to-1');
type CreatePostProps = {
    setMode: (value: string) => void;
    prevBlur?: PostListItem;
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
    const [isReply, setIsReply] = useState<boolean>(false)
    const [replyPost, setReplyPost] = useState<PostView | undefined>()
    const tempReply = useTempPostStore((state) => state.reply);
    const setTempReply = useTempPostStore((state) => state.setReply);
    const [isEncrypt, setIsEncrypt] = useState<boolean>(false)
    const encryptKey = useTempPostStore((state) => state.encryptKey) || '';
    const setEncryptKey = useTempPostStore((state) => state.setEncryptKey);
    const { notifySuccess, notifyError } = useNotification();


    const [encStr, setEngStr] = useState("");

    function detectLanguage(text: string): string {
        // francを使用してテキストの言語を検出
        const lang3 = franc(text);

        console.log(lang3)

        // 3文字の言語コードを2文字のコードに変換。
        // 未対応の場合は 現在の表示言語 を返す
        const lang2 = iso6393to1(lang3) || locale.CreatePost_Lang;

        return lang2;
    }

    function handleSetIsReply(param: boolean) {
        setIsReply(param)

        if (!param) {
            setReplyPost(undefined)
            setTempReply('')
        }

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
        setPostText(postText.replace(/［/g, '[').replace(/］/g, ']'), simpleMode)
    }

    const handleSetReplyPost = async (post: PostView) => {
        setReplyPost(post)
        setTempReply(post.uri)
        console.log(post)

    }

    const handleSetPostText = (text: string) => {
        setPostText(text, simpleMode)

    }

    type MatchInfo = {
        detectedString: string;
        startIndex: number;
        endIndex: number;
        did: string;
    }

    async function detectPatternWithDetails(str: string): Promise<MatchInfo[]> {
        if (!agent) return []
        const matches: MatchInfo[] = [];
        const regex = /@[a-z]+(?:\.[a-z]+)+(?=\s|$|[\u3000-\uFFFD])/g;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(str)) !== null) {
            try {
                const result = await agent.app.bsky.actor.getProfile({
                    actor: match[0].slice(1)
                });

                matches.push({
                    detectedString: match[0],
                    startIndex: match.index,
                    endIndex: match.index + match[0].length,
                    did: result.data.did
                });
            } catch (e) {
                console.error(e)

            }
        }


        return matches;
    }


    const setPostText = (text: string, simpleMode: boolean) => {
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

        if (!prevBlur) setTempText(text)

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

        try {
            let rkey = TID.nextStr()

            if (prevBlur && prevBlur.blurATUri) {
                const regex = /\/([^/]+)$/;
                const match = prevBlur.blurATUri.match(regex);
                if (match) {
                    rkey = match[1];
                }

            }

            let localPrevPostAturi = `at://${did}/app.bsky.feed.post/${rkey}`

            const url = '/post/' + did + "/" + rkey
            const tempUrl = origin + url
            const blurUri = `at://${did}/${SKYBLUR_POST_COLLECTION}/${rkey}`

            //createRecord用
            const writes = [];

            //参照範囲
            let visibility = VISIBILITY_PUBLIC
            if (isEncrypt) visibility = VISIBILITY_PASSWORD


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

                /*
                const postObj: Partial<AppBskyFeedPost.Record> &
                    Omit<AppBskyFeedPost.Record, 'createdAt'> = {
                    $type: 'app.bsky.feed.post',
                    text: rt.text,
                    facets: rt.facets,
                    langs: langs,
                    via: 'Skyblur',
                    "uk.skyblur.post.uri": blurUri,
                    "uk.skyblur.post.encrypt": isEncrypt
                };
                */

                let appBskyFeedPost: Partial<AppBskyFeedPost.Record> = {
                    text: rt.text,
                    facets: rt.facets,
                    langs: langs,
                    via: 'Skyblur',
                    "uk.skyblur.post.uri": blurUri,
                    "uk.skyblur.post.visibility": visibility,
                    createdAt: new Date().toISOString()
                };

                console.log(rt.facets)

                if (replyPost) {
                    const reply = {
                        root: {
                            cid: replyPost.record.reply?.root.cid || replyPost.cid,

                            uri: replyPost.record.reply?.root.uri || replyPost.uri,
                        },
                        parent: {
                            cid: replyPost.cid || '',
                            uri: replyPost.uri || ''
                        }
                    }
                    appBskyFeedPost.reply = reply

                }

                //postObj.facets = new Array(0);


                /*
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

                //メンション
                const mentions = await detectPatternWithDetails(postTextBlurLocal)
                console.log(mentions)


                for (const obj of mentions) {
                    const fromText = postTextBlurLocal.slice(0, obj.startIndex);
                    const toText = postTextBlurLocal.slice(0, obj.endIndex);

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
                                    "$type": "app.bsky.richtext.facet#mention",
                                    "did": obj.did
                                }
                            ]
                        }
                    );
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

                */

                const localDesc = locale.CreatePost_OGPDescription

                // OGP設定
                appBskyFeedPost.embed = {
                    $type: 'app.bsky.embed.external',
                    external: {
                        uri: tempUrl,
                        title: locale.CreatePost_OGPTitle,
                        description: localDesc,
                    },
                };

                //URLをリンク化
                Object.keys(urlArray).forEach(function (key) {
                    if (typeof appBskyFeedPost.facets !== "undefined") {
                        appBskyFeedPost.facets.push(
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

                writes.push({
                    $type: 'com.atproto.repo.applyWrites#create',
                    collection: 'app.bsky.feed.post',
                    rkey: rkey,
                    value: appBskyFeedPost,
                })

            }

            let postObject
            let applyKey

            if (prevBlur) {
                applyKey = 'com.atproto.repo.applyWrites#update'
            } else {
                applyKey = 'com.atproto.repo.applyWrites#create'

            }

            if (isEncrypt) {

                let encBody = {
                    text: postText,
                    additional: addText
                }

                const init: RequestInit = {
                    method: 'POST',
                    body: JSON.stringify({
                        body: JSON.stringify(encBody),
                        password: encryptKey
                    })
                }

                const host = new URL(origin).host;
                const response = await agent.withProxy('skyblur', `did:web:${host}`).fetchHandler(
                    '/xrpc/uk.skyblur.post.encrypt',
                    init
                )

                const data = await response.json();
                if (response.ok) {
                    const blob = new Blob([data.encryptedText], { type: "text/plain" });

                    // BlobをUint8Arrayに変換
                    const arrayBuffer = await blob.arrayBuffer();
                    const uint8Array = new Uint8Array(arrayBuffer);

                    const ret = await agent?.com.atproto.repo.uploadBlob(uint8Array);

                    postObject = {
                        uri: localPrevPostAturi,
                        text: postTextBlur,
                        additional: '',
                        createdAt: prevBlur?.blur.createdAt || new Date().toISOString(),
                        encryptBody: ret.data.blob,
                        visibility: visibility,
                    }

                    writes.push({
                        $type: applyKey,
                        collection: SKYBLUR_POST_COLLECTION,
                        rkey: rkey,
                        value: postObject,
                    })

                } else {
                    console.error("❌ Encryption Error:", data.error);
                    notifyError("Error:" + data.error)
                    setIsLoading(false)
                    return
                }
            } else {
                postObject = {
                    uri: localPrevPostAturi,
                    text: postTextForRecord,
                    additional: addText,
                    createdAt: prevBlur?.blur.createdAt || new Date().toISOString(),
                    visibility: visibility,
                }

                writes.push({
                    $type: applyKey,
                    collection: SKYBLUR_POST_COLLECTION,
                    rkey: rkey,
                    value: postObject,
                })

            }

            const ret = await agent.com.atproto.repo.applyWrites({
                repo: did,
                writes: writes
            })

            if (ret.success) {
                const convertedUri = "completed";
                notifySuccess(locale.CreatePost_Complete)
                setAppUrl(convertedUri)
                setPostTest('')
                setAddText('')
                setMode('menu')
                setEncryptKey('')
                if (!prevBlur) handleTempDelete()

            } else {
                console.error(ret)
                notifyError("Error:" + ret)

            }
        } catch (e) {
            notifyError("Error:" + e)

        }
        setIsLoading(false)
    }


    useEffect(() => {
        if (prevBlur) {
            console.log(prevBlur)
            setPostText(prevBlur.blur.text, false)
            setAddText(prevBlur.blur.additional)
            if (prevBlur.encryptKey) {
                setEncryptKey(prevBlur.encryptKey)
                setIsEncrypt(true)
            }

        } else if (tempText || tempAdditional || tempReply) {
            setIsTempRestore(true)

        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [did, prevBlur]); // Make sure to use the correct second dependency


    const handleCheckboxChange = (isChecked: boolean) => {
        setSimpleMode(isChecked);
        if (!prevBlur) setTempSimpleMode(isChecked);
        setPostText('', isChecked); // テキストを空にします
    };

    const handleAddText = (addText: string) => {
        setAddText(addText);
        if (!prevBlur) setTempAdditional(addText);
    };

    const handleTempDelete = () => {
        setTempText('')
        setTempAdditional('')
        setTempSimpleMode(false)
        setTempReply('')
        setEncryptKey('')
    };

    const handleTempApply = async () => {
        console.log('handleTempApply')
        setPostText(tempText, tempSimpleMode);
        setAddText(tempAdditional)
        setSimpleMode(tempSimpleMode)
        if (tempReply && agent && tempReply.includes(did)) {
            const result = await agent.app.bsky.feed.getPosts({
                uris: [tempReply]
            })

            setIsReply(true)
            setReplyPost(result.data.posts[0] as PostView)
        }
        if (encryptKey) setIsEncrypt(true)
    };

    const handleModalClose = () => {
        setIsTempRestore(false)
    };


    return (
        <>
            <div className="m-3">

                {isTempRestore &&
                    <RestoreTempPost content={tempText} onApply={handleTempApply} onClose={handleModalClose} onDelete={handleTempDelete} />
                }




                {(!appUrl) &&
                    <>

                        <label className="">{locale.CreatePost_Post}</label>

                        <div className="flex my-1">
                            <p className="flex items-center">
                                <Toggle
                                    checked={simpleMode}
                                    onChange={handleCheckboxChange} // Boolean を渡します
                                />
                                <span className="ml-2">{locale.CreatePost_SimpleMode}</span>
                            </p>
                        </div>
                        {simpleMode ?
                            <div className="block text-sm text-gray-400 mt-1">{locale.CreatePost_PostSimpleModeDescription}</div>
                            :
                            <div className="block text-sm text-gray-400 mt-1">{locale.CreatePost_PostComplexDescription}</div>
                        }
                        <AutoResizeTextArea
                            text={postText}
                            setPostText={handleSetPostText}
                            disabled={false}
                            locale={locale}
                            placeHolder={locale.CreatePost_PostPlaceHolder}
                            max={300}
                            isEnableBrackets={!simpleMode}
                            error={warning}
                        />
                        <div className="flex justify-center gap-4 mb-8">
                            {isIncludeFullBranket &&
                                <Button color="primary" size="large" className="text-white text-base font-normal mt-2" onClick={convertFullWidthToHalfWidthBrackets} disabled={isLoading}>
                                    {locale.CreatePost_BracketFromFullToHalf}
                                </Button>
                            }
                        </div>

                        {!prevBlur &&
                            <>
                                <div className='mt-2'>{locale.CreatePost_Preview}</div>
                                <div className="block text-sm text-gray-400 mt-1">{locale.CreatePost_PreviewDescription}</div>

                                <AutoResizeTextArea
                                    text={postTextBlur}
                                    setPostText={handleSetPostText}
                                    disabled={true}
                                    locale={locale}
                                    placeHolder={locale.CreatePost_PreviewPlaceHolder}
                                    max={10000}
                                    isEnableBrackets={false}
                                />
                            </>
                        }

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

                        {!prevBlur &&
                            <div className='mb-6 '>
                                <div className='mt-4 mb-2'>{locale.ReplyList_Reply}</div>
                                <div className="block text-sm text-gray-400 mt-1">{locale.ReplyList_ReplyLabelDescription}</div>
                                <p className="flex items-center mt-2">
                                    <Toggle
                                        checked={isReply}
                                        onChange={handleSetIsReply} // Boolean を渡します
                                    />
                                    <span className="ml-2">{locale.ReplyList_UseReply}</span>
                                </p>

                                {isReply &&
                                    <>
                                        {replyPost &&
                                            <div
                                                className="p-2 m-2 bg-white rounded-md border border-gray-300 w-full "
                                            >
                                                <div>

                                                    <div
                                                        dangerouslySetInnerHTML={{
                                                            __html: DOMPurify.sanitize(replyPost.record.text.replace(/\n/g, '<br />')),
                                                        }}
                                                    ></div>
                                                </div>

                                                <div className="flex justify-between items-center gap-2 mt-2">
                                                    <div className="text-sm text-gray-400">{formatDateToLocale(replyPost.record.createdAt)}</div>
                                                    <div className="flex sm:gap-6 gap-4">
                                                        <IconButton size="small" variant="text"  >
                                                            <a href={transformUrl(replyPost.uri)} target="_blank">
                                                                <svg width="20" height="20" viewBox="0 0 1452 1452" xmlns="http://www.w3.org/2000/svg"><path d="M725.669,684.169c85.954,-174.908 196.522,-329.297 331.704,-463.171c45.917,-43.253 98.131,-74.732 156.638,-94.443c80.779,-23.002 127.157,10.154 139.131,99.467c-2.122,144.025 -12.566,287.365 -31.327,430.015c-29.111,113.446 -96.987,180.762 -203.629,201.947c-36.024,5.837 -72.266,8.516 -108.726,8.038c49.745,11.389 95.815,32.154 138.21,62.292c77.217,64.765 90.425,142.799 39.62,234.097c-37.567,57.717 -83.945,104.938 -139.131,141.664c-82.806,48.116 -154.983,33.716 -216.529,-43.202c-28.935,-38.951 -52.278,-81.818 -70.026,-128.603c-12.177,-34.148 -24.156,-68.309 -35.935,-102.481c-11.779,34.172 -23.757,68.333 -35.934,102.481c-17.748,46.785 -41.091,89.652 -70.027,128.603c-61.545,76.918 -133.722,91.318 -216.529,43.202c-55.186,-36.726 -101.564,-83.947 -139.131,-141.664c-50.804,-91.298 -37.597,-169.332 39.62,-234.097c42.396,-30.138 88.466,-50.903 138.21,-62.292c-36.46,0.478 -72.702,-2.201 -108.725,-8.038c-106.643,-21.185 -174.519,-88.501 -203.629,-201.947c-18.762,-142.65 -29.205,-285.99 -31.328,-430.015c11.975,-89.313 58.352,-122.469 139.132,-99.467c58.507,19.711 110.72,51.19 156.637,94.443c135.183,133.874 245.751,288.263 331.704,463.171Z" fill="currentColor" /></svg>
                                                            </a>
                                                        </IconButton>
                                                    </div>
                                                </div>
                                            </div>
                                        }
                                        {!replyPost &&
                                            <ReplyList handleSetPost={handleSetReplyPost} />
                                        }
                                    </>
                                }
                            </div>
                        }

                        <div className='mb-6 '>
                            <div className='mt-4 mb-2'>{locale.CreatePost_PasswordTitle}</div>
                            <div className="block text-sm text-gray-400 mt-1">{locale.CreatePost_PasswordDescription}</div>
                            <p className="flex items-center mt-2">
                                <Toggle
                                    checked={isEncrypt}
                                    onChange={setIsEncrypt} // Boolean を渡します
                                    disabled={prevBlur ? true : false}
                                />
                                <span className="ml-2">{locale.CreatePost_PasswordRadio}</span>
                            </p>

                            {isEncrypt &&
                                <div className=''>
                                    <div className="block text-sm text-gray-400 mt-1">{locale.CreatePost_PasswordInputDescription}</div>
                                    <Input value={encryptKey} size="medium" onValueChange={setEncryptKey} max={20} />
                                    {encStr}
                                </div>


                            }

                        </div>

                        <div className="flex justify-center gap-4 mb-8 mt-2">
                            {!warning && (
                                (isReply && replyPost) || !isReply
                            ) && (
                                    <Button
                                        color="primary"
                                        size="large"
                                        className="text-white text-base font-normal"
                                        onClick={handleCrearePost}
                                        disabled={isLoading || postText.length === 0 || (isEncrypt && encryptKey.length === 0)}
                                    >
                                        {prevBlur ? (
                                            <>{locale.CreatePost_UpdateButton}</>
                                        ) : (
                                            <>{locale.CreatePost_CreateButton}</>
                                        )}
                                    </Button>
                                )}
                        </div>
                    </>
                }

            </div>
        </>
    )
}