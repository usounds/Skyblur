"use client"
import AutoResizeTextArea from "@/components/AutoResizeTextArea";
import { ReplyList } from "@/components/ReplyList";
import { UkSkyblurPostEncrypt } from "@/lexicon/UkSkyblur";
import { transformUrl } from "@/logic/HandleBluesky";
import { formatDateToLocale } from "@/logic/LocaledDatetime";
import { useLocaleStore } from "@/state/Locale";
import { useTempPostStore } from "@/state/TempPost";
import { useXrpcAgentStore } from "@/state/XrpcAgent";
import { MENTION_REGEX, PostListItem, PostView, SKYBLUR_POST_COLLECTION, TAG_REGEX, TRAILING_PUNCTUATION_REGEX, VISIBILITY_LOGIN, VISIBILITY_PASSWORD, VISIBILITY_PUBLIC, THREADGATE_MENTION, THREADGATE_FOLLOWING, THREADGATE_FOLLOWERS, THREADGATE_QUOTE_ALLOW } from "@/types/types";
import '@atcute/atproto';
import '@atcute/bluesky';
import { AppBskyFeedPost, AppBskyRichtextFacet } from '@atcute/bluesky';
import { Client } from '@atcute/client';
import { ActorIdentifier, ResourceUri } from '@atcute/lexicons/syntax';
import { IdentityResolver } from '@/logic/IdentityResolver';
import * as TID from '@atcute/tid';
import { Button, Card, Chip, Group, Modal, SegmentedControl, Switch, Text, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import DOMPurify from 'dompurify';
import { franc } from 'franc';
import { useEffect, useState } from "react";
import { X, Check } from 'lucide-react';
import { BlueskyIcon } from './Icons';

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
    const agent = useXrpcAgentStore((state) => state.agent);
    const locale = useLocaleStore((state) => state.localeData);
    const did = useXrpcAgentStore((state) => state.did);
    const oauthUserAgent = useXrpcAgentStore((state) => state.oauthUserAgent);
    const setTempText = useTempPostStore((state) => state.setText);
    const setTempAdditional = useTempPostStore((state) => state.setAdditional);
    const setTempSimpleMode = useTempPostStore((state) => state.setSimpleMode);
    const tempText = useTempPostStore((state) => state.text);
    const tempAdditional = useTempPostStore((state) => state.additional);
    const tempSimpleMode = useTempPostStore((state) => state.simpleMode);
    const [isReply, setIsReply] = useState<boolean>(false)
    const [replyPost, setReplyPost] = useState<PostView | undefined>()
    const tempReply = useTempPostStore((state) => state.reply);
    const setTempReply = useTempPostStore((state) => state.setReply);
    const [visibility, setVisibilityState] = useState<string>(prevBlur?.blur.visibility || VISIBILITY_PUBLIC);
    const tempVisibility = useTempPostStore((state) => state.visibility);
    const setTempVisibility = useTempPostStore((state) => state.setVisibility);
    const [isEncrypt, setIsEncrypt] = useState<boolean>(prevBlur?.blur.visibility === VISIBILITY_PASSWORD);
    const encryptKey = useTempPostStore((state) => state.encryptKey) || '';
    const [threadGate, setThreadGate] = useState<string[]>([THREADGATE_QUOTE_ALLOW]);
    const setEncryptKey = useTempPostStore((state) => state.setEncryptKey);
    const [buttonName, setButtonName] = useState(locale.CreatePost_CreateButton);
    const [changeModeOpened, { open: openChangeMode, close: closeChangeMode }] = useDisclosure(false);
    const [restorePostData, { open: openRestorePostData, close: closeRestorePostData }] = useDisclosure(false);

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


        if (simpleMode && text && (text.includes("[") || text.includes("]"))) {
            setWarning(locale.CreatePost_NotBracketInSimpleMode);
            return;
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
        if (isEncrypt) {
            if (/[ \t\r\n\u3000]/.test(encryptKey)) {
                notifications.show({
                    title: 'Error',
                    message: locale.CreatePost_PasswordErrorSpace,
                    color: 'red',
                    icon: <X />
                });
                return
            }
        }
        if (!postText) return
        setIsLoading(true)
        setAppUrl('')

        try {
            let rkey = TID.now();

            if (prevBlur && prevBlur.blurATUri) {
                const regex = /\/([^/]+)$/;
                const match = prevBlur.blurATUri.match(regex);
                if (match) {
                    rkey = match[1];
                }

            }

            const localPrevPostAturi = `at://${did}/app.bsky.feed.post/${rkey}`
            const url = '/post/' + did + "/" + rkey
            const tempUrl = origin + url
            const blurUri = `at://${did}/${SKYBLUR_POST_COLLECTION}/${rkey}`

            type WriteCreate = {
                $type: 'com.atproto.repo.applyWrites#create';
                collection: `${string}.${string}.${string}`;
                rkey?: string;
                value: Record<string, unknown>;
            };

            type WriteUpdate = {
                $type: 'com.atproto.repo.applyWrites#update';
                collection: `${string}.${string}.${string}`;
                rkey: string;
                value: Record<string, unknown>;
            };

            type WriteDelete = {
                $type: 'com.atproto.repo.applyWrites#delete';
                collection: `${string}.${string}.${string}`;
                rkey: string;
            };

            type Write = WriteCreate | WriteUpdate | WriteDelete;

            const writes: Write[] = [];

            //参照範囲
            // visibility state is already used


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

                const facets: AppBskyRichtextFacet.Main[] = [];

                // ハッシュタグ
                let m: RegExpExecArray | null;
                function utf16IndexToUtf8Index(str: string, utf16Index: number): number {
                    return new TextEncoder().encode(str.slice(0, utf16Index)).length;
                }

                while ((m = TAG_REGEX.exec(postTextBlurLocal))) {
                    const prefix = m[1];
                    let candidateTag = m[2];

                    if (!candidateTag) continue;

                    candidateTag = candidateTag.trim().replace(TRAILING_PUNCTUATION_REGEX, '');

                    if (candidateTag.length === 0 || candidateTag.length > 64) continue;

                    const startPos = m.index + prefix.length;
                    const fullTag = '#' + candidateTag;

                    const byteStart = utf16IndexToUtf8Index(postTextBlurLocal, startPos);
                    const byteLength = new TextEncoder().encode(fullTag).length;
                    const byteEnd = byteStart + byteLength;

                    facets.push({
                        index: {
                            byteStart,
                            byteEnd,
                        },
                        features: [
                            {
                                $type: 'app.bsky.richtext.facet#tag' as const,
                                tag: candidateTag,
                            },
                        ],
                    });
                }

                // ドメインの簡易検証関数
                function isLikelyValidDomain(domain: string) {
                    return /^[\w.-]+\.[a-z]{2,}$/i.test(domain);
                }

                async function extractMentionsWithFacets(text: string) {
                    console.log('text')
                    console.log(text)

                    for (const match of text.matchAll(MENTION_REGEX)) {
                        const handle = match[3];

                        // ドメインチェック（.test は特例として許可）
                        if (!isLikelyValidDomain(handle) && !handle.endsWith(".test")) {
                            continue;
                        }

                        const startIndexUtf16 = match.index ?? 0;
                        const endIndexUtf16 = startIndexUtf16 + match[0].length;
                        const result = await IdentityResolver.resolve(handle as ActorIdentifier)

                        facets.push({
                            $type: "app.bsky.richtext.facet",
                            index: {
                                byteStart: utf16IndexToUtf8Index(text, startIndexUtf16),
                                byteEnd: utf16IndexToUtf8Index(text, endIndexUtf16),
                            },
                            features: [
                                {
                                    $type: "app.bsky.richtext.facet#mention",
                                    did: result.did,
                                },
                            ],
                        });
                    }

                    return facets;
                }

                const mentionFacets = await extractMentionsWithFacets(postTextBlurLocal);
                console.log(mentionFacets)
                facets.push(...mentionFacets);

                console.log(facets)

                const langs = [detectLanguage(postText)]

                type MyPost = AppBskyFeedPost.Main & {
                    via?: string;
                    "uk.skyblur.post.uri"?: string;
                    "uk.skyblur.post.visibility"?: string;
                };

                const appBskyFeedPost: MyPost = {
                    $type: "app.bsky.feed.post",
                    text: postTextBlurLocal,
                    langs: langs,
                    via: 'Skyblur',
                    "uk.skyblur.post.uri": blurUri,
                    "uk.skyblur.post.visibility": visibility,
                    createdAt: new Date().toISOString(),
                    facets: facets
                };

                if (replyPost) {
                    appBskyFeedPost.reply = {
                        $type: "app.bsky.feed.post#replyRef",
                        root: {
                            cid: replyPost.record.reply?.root.cid || replyPost.cid,
                            uri: replyPost.record.reply?.root.uri as ResourceUri || replyPost.uri as ResourceUri,
                            $type: "com.atproto.repo.strongRef"
                        },
                        parent: {
                            cid: replyPost.cid || '',
                            uri: replyPost.uri as unknown as ResourceUri,
                            $type: "com.atproto.repo.strongRef"
                        }
                    }
                }

                // OGP設定
                let ogpDescription = locale.CreatePost_OGPDescription;
                if (isEncrypt) ogpDescription = ogpDescription + locale.CreatePost_OGPDescriptionPassword;

                appBskyFeedPost.embed = {
                    $type: 'app.bsky.embed.external',
                    external: {
                        uri: tempUrl as unknown as ResourceUri,
                        title: locale.CreatePost_OGPTitle,
                        description: ogpDescription,
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
                                        "uri": key as `${string}:${string}`
                                    }
                                ]
                            }
                        );
                    }
                });

                writes.push({
                    $type: 'com.atproto.repo.applyWrites#create',  // こちらはAPIの操作種別
                    collection: 'app.bsky.feed.post' as `${string}.${string}.${string}`,
                    rkey: rkey,
                    value: appBskyFeedPost as unknown as Record<string, unknown>,
                });

                // Thread Gate (Reply control)
                const interactionRules = threadGate.filter(val => val !== THREADGATE_QUOTE_ALLOW);
                if (interactionRules.length > 0) {
                    const allowRules: { $type: string }[] = [];
                    if (interactionRules.includes(THREADGATE_MENTION)) allowRules.push({ $type: 'app.bsky.feed.threadgate#mentionRule' });
                    if (interactionRules.includes(THREADGATE_FOLLOWING)) allowRules.push({ $type: 'app.bsky.feed.threadgate#followingRule' });
                    if (interactionRules.includes(THREADGATE_FOLLOWERS)) allowRules.push({ $type: 'app.bsky.feed.threadgate#followerRule' });

                    writes.push({
                        $type: 'com.atproto.repo.applyWrites#create',
                        collection: 'app.bsky.feed.threadgate',
                        rkey: rkey,
                        value: {
                            $type: 'app.bsky.feed.threadgate',
                            post: `at://${did}/app.bsky.feed.post/${rkey}`,
                            allow: allowRules,
                            createdAt: new Date().toISOString(),
                        },
                    });
                }

                // Post Gate (Quote control)
                if (!threadGate.includes(THREADGATE_QUOTE_ALLOW)) {
                    writes.push({
                        $type: 'com.atproto.repo.applyWrites#create',
                        collection: 'app.bsky.feed.postgate',
                        rkey: rkey,
                        value: {
                            $type: 'app.bsky.feed.postgate',
                            post: `at://${did}/app.bsky.feed.post/${rkey}`,
                            embeddingRules: [{ $type: 'app.bsky.feed.postgate#disableRule' }],
                            detachedEmbeddingUris: [],
                            createdAt: new Date().toISOString(),
                        },
                    });
                }

            }

            let postObject
            let applyKey:
                | 'com.atproto.repo.applyWrites#create'
                | 'com.atproto.repo.applyWrites#update';

            if (prevBlur) {
                applyKey = 'com.atproto.repo.applyWrites#update';
            } else {
                applyKey = 'com.atproto.repo.applyWrites#create';
            }

            if (isEncrypt) {

                const encBody = {
                    text: postText,
                    additional: addText
                }

                notifications.show({
                    id: 'post-process',
                    title: locale.Menu_Post,
                    message: locale.CreatePost_EncryptInProgress,
                    loading: true,
                    autoClose: false
                });

                const host = new URL(origin).host;
                let appViewUrl = 'skyblur.uk'
                if (host?.endsWith('dev.skyblur.uk')) {
                    appViewUrl = 'dev.skyblur.uk'
                }

                const body: UkSkyblurPostEncrypt.Input = {
                    body: JSON.stringify(encBody),
                    password: encryptKey
                }

                if (!oauthUserAgent) return

                const apiProxyAgent = new Client({
                    handler: oauthUserAgent,
                    proxy: {
                        did: `did:web:${appViewUrl}`,
                        serviceId: '#skyblur_api'
                    }
                })

                const response = await apiProxyAgent.post('uk.skyblur.post.encrypt', {
                    input: body as unknown as Record<string, unknown>,
                    as: 'json',
                });

                const data: UkSkyblurPostEncrypt.Output = response.data as UkSkyblurPostEncrypt.Output;
                if (response.ok) {
                    const blob = new Blob([data.body], { type: "text/plain" });

                    // BlobをUint8Arrayに変換
                    const arrayBuffer = await blob.arrayBuffer();
                    const uint8Array = new Uint8Array(arrayBuffer);

                    notifications.update({
                        id: 'post-process',
                        title: locale.Menu_Post,
                        message: locale.CreatePost_BlobUploadInProgress,
                        loading: true,
                        autoClose: false
                    });

                    const ret = await agent.post('com.atproto.repo.uploadBlob', {
                        input: uint8Array,
                        encoding: 'binary',
                        headers: { 'Content-Type': 'application/octet-stream' }
                    });

                    if (!ret.ok) {
                        console.error("❌ Blob Upload Error:", ret.data);
                        handleInitButton()
                        notifications.show({
                            title: 'Error',
                            message: "Blob upload failed",
                            color: 'red',
                            icon: <X />
                        });
                        setIsLoading(false)
                        return
                    }

                    postObject = {
                        uri: localPrevPostAturi,
                        text: postTextBlur,
                        additional: '',
                        createdAt: prevBlur?.blur.createdAt || new Date().toISOString(),
                        encryptBody: (ret.data as any).blob,
                        visibility: visibility,
                    }

                    writes.push({
                        $type: applyKey,
                        collection: SKYBLUR_POST_COLLECTION,
                        rkey: rkey,
                        value: postObject,
                    })


                } else {
                    console.error("❌ Encryption Error:", data.message);
                    handleInitButton()
                    notifications.clean()
                    notifications.show({
                        title: 'Error',
                        message: data.message,
                        color: 'red',
                        icon: <X />
                    });
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
                    collection: SKYBLUR_POST_COLLECTION as `${string}.${string}.${string}`,
                    rkey: rkey,
                    value: postObject as unknown as Record<string, unknown>,
                });
            }

            let buttonName = ''

            if (isEncrypt) buttonName = '(3/3)' + locale.CreatePost_PostInProgress
            else buttonName = locale.CreatePost_PostInProgress

            notifications.clean()
            notifications.show({
                id: 'post-process',
                title: locale.Menu_Post,
                message: buttonName,
                loading: true,
                autoClose: false
            });

            const ret = await agent.post('com.atproto.repo.applyWrites', {
                input: {
                    repo: did as ActorIdentifier,
                    writes: writes
                },
            });


            if (ret.ok) {
                const convertedUri = "completed";
                notifications.clean()
                notifications.show({
                    title: 'Success',
                    message: locale.CreatePost_Complete,
                    color: 'teal',
                    icon: <Check />
                });
                setAppUrl(convertedUri)
                setPostTest('')
                setAddText('')
                setMode('menu')
                setEncryptKey('')
                if (!prevBlur) handleTempDelete()

            } else {
                console.error(ret)
                handleInitButton()
                notifications.clean()
                notifications.show({
                    title: 'Error',
                    message: "Error:" + ret,
                    color: 'red',
                    icon: <X />
                });

            }
        } catch (e) {
            handleInitButton()
            //notifyError("Error:" + e)
            notifications.clean()
            notifications.show({
                title: 'Error',
                message: "Error:" + e,
                color: 'red',
                icon: <X />
            });

        }
        handleInitButton()
        setIsLoading(false)
    }

    useEffect(() => {
        if (prevBlur) {
            handleInitButton()
            setPostText(prevBlur.blur.text, false)
            setAddText(prevBlur.blur.additional || '')
            if (prevBlur.encryptKey) {
                setEncryptKey(prevBlur.encryptKey)
                setIsEncrypt(true)
            }

        } else if (tempText || tempAdditional || tempReply) {
            setTimeout(() => {
                openRestorePostData();
            }, 200);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [did, prevBlur]); // Make sure to use the correct second dependency

    const handleInitButton = () => {
        if (prevBlur)
            setButtonName(locale.CreatePost_UpdateButton)
        else
            setButtonName(locale.CreatePost_CreateButton)
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
        setTempVisibility(VISIBILITY_PUBLIC)
    };

    const handleTempApply = async () => {
        console.log('tempText:' + tempText)
        setPostText(tempText, tempSimpleMode);
        setAddText(tempAdditional)
        setSimpleMode(tempSimpleMode)
        setVisibilityState(tempVisibility ?? VISIBILITY_PUBLIC)
        setIsEncrypt(tempVisibility === VISIBILITY_PASSWORD)
        if (tempReply && agent && tempReply.includes(did)) {
            const result = await agent.get("app.bsky.feed.getPosts", {
                params: {
                    uris: [tempReply as unknown as ResourceUri]
                }
            });

            if (!result.ok) return

            setIsReply(true)
            setReplyPost(result.data.posts[0] as PostView)
        }
        if (encryptKey) setIsEncrypt(true)
    };

    return (
        <>
            <div className="m-3">

                <Modal
                    opened={restorePostData}
                    onClose={() => {
                        closeRestorePostData();
                    }}
                    title={locale.CreatePost_RestoreTitle}
                    centered
                >
                    <Text>{tempText}</Text>
                    <Group mt="md" style={{ justifyContent: 'flex-end' }}>
                        <Button
                            variant="default"
                            color="gray"
                            onClick={() => {
                                closeRestorePostData();
                            }}
                        >
                            {locale.DeleteList_CancelButton}
                        </Button>
                        <Button
                            variant="filled"
                            color="red"
                            onClick={async () => {
                                handleTempDelete()
                                closeRestorePostData();
                            }}
                            loaderProps={{ type: 'dots' }}
                        >
                            {locale.DeleteList_DeleteButton}
                        </Button>
                        <Button
                            variant="filled"
                            onClick={async () => {
                                handleTempApply()
                                closeRestorePostData();
                            }}
                            loaderProps={{ type: 'dots' }}
                        >
                            {locale.CreatePost_RestoreButton}
                        </Button>
                    </Group>
                </Modal>

                <Modal
                    opened={changeModeOpened}
                    onClose={() => {
                        closeChangeMode();
                    }}
                    title={locale.CreatePost_ChangeSimpleMode}
                    centered
                >
                    <Text>{locale.CreatePost_ChangeSimpleModeDescription}</Text>
                    <Group mt="md" style={{ justifyContent: 'flex-end' }}>
                        <Button
                            variant="default"
                            color="gray"
                            onClick={() => {
                                setSimpleMode(simpleMode);
                                closeChangeMode();
                            }}
                        >
                            {locale.DeleteList_CancelButton}
                        </Button>
                        <Button
                            variant="filled"
                            color="red"
                            onClick={async () => {
                                setSimpleMode(!simpleMode);
                                if (!prevBlur) setTempSimpleMode(!simpleMode);
                                setPostText('', !simpleMode);
                                closeChangeMode();
                            }}
                            loaderProps={{ type: 'dots' }}
                        >
                            {locale.CreatePost_OK}
                        </Button>
                    </Group>
                </Modal>

                {(!appUrl) &&
                    <>

                        <label className="">{locale.CreatePost_Post}</label>

                        <div className="flex my-1">
                            <div className="flex items-center">
                                <Switch
                                    checked={simpleMode}
                                    onChange={() => {
                                        openChangeMode();
                                    }}
                                    label={locale.CreatePost_SimpleMode}
                                />
                            </div>
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
                                <div className="flex items-center mt-2">
                                    <Switch
                                        checked={isReply}
                                        onChange={(event) => handleSetIsReply(event.currentTarget.checked)}
                                        label={locale.ReplyList_UseReply}
                                    />
                                </div>

                                {isReply &&
                                    <>
                                        {replyPost &&
                                            <Card withBorder p="sm" my="sm" radius="md" w="100%">
                                                <div>

                                                    <div
                                                        dangerouslySetInnerHTML={{
                                                            __html: DOMPurify.sanitize(replyPost.record.text.replace(/\n/g, '<br />')),
                                                        }}
                                                    ></div>
                                                </div>

                                                <div className="flex justify-between items-center gap-2 mt-2">
                                                    <div className="text-sm">{formatDateToLocale(replyPost.record.createdAt)}</div>
                                                    <div className="flex sm:gap-6 gap-4">
                                                        <a href={transformUrl(replyPost.uri)} target="_blank">
                                                            <BlueskyIcon size={20} />
                                                        </a>
                                                    </div>
                                                </div>
                                            </Card>
                                        }
                                        {!replyPost &&
                                            <ReplyList handleSetPost={handleSetReplyPost} did={did} />
                                        }
                                    </>
                                }
                            </div>
                        }

                        <div className='mb-4 '>
                            <div className='mt-4 mb-2'>{locale.CreatePost_PublishMethodTitle}</div>
                            <div className="block text-sm text-gray-400 mt-1 mb-2">{locale.CreatePost_PublishMethodDescription}</div>

                            <SegmentedControl
                                value={visibility}
                                onChange={(value) => {
                                    setVisibilityState(value);
                                    setIsEncrypt(value === VISIBILITY_PASSWORD);
                                    if (!prevBlur) setTempVisibility(value);
                                }}
                                disabled={prevBlur && prevBlur.blur.visibility === VISIBILITY_PASSWORD}
                                data={[
                                    { label: locale.CreatePost_VisibilityPublic, value: VISIBILITY_PUBLIC, disabled: prevBlur && prevBlur.blur.visibility === VISIBILITY_PASSWORD },
                                    { label: locale.CreatePost_VisibilityLogin, value: VISIBILITY_LOGIN, disabled: prevBlur && prevBlur.blur.visibility === VISIBILITY_PASSWORD },
                                    { label: locale.CreatePost_VisibilityPassword, value: VISIBILITY_PASSWORD, disabled: prevBlur && prevBlur.blur.visibility !== VISIBILITY_PASSWORD },
                                ]}
                                fullWidth
                            />

                            <div className="block text-sm text-gray-400 mt-2">
                                {visibility === VISIBILITY_PUBLIC && locale.CreatePost_VisibilityPublicDescription}
                                {visibility === VISIBILITY_LOGIN && locale.CreatePost_VisibilityLoginDescription}
                                {visibility === VISIBILITY_PASSWORD && locale.CreatePost_VisibilityPasswordDescription}
                            </div>

                            {isEncrypt &&
                                <div className=''>
                                    <div className="block text-sm text-gray-400 my-1">{locale.CreatePost_PasswordInputDescription}</div>
                                    <TextInput
                                        value={encryptKey}
                                        maxLength={20}
                                        placeholder="p@ssw0rd"
                                        styles={{
                                            input: {
                                                fontSize: 16,  // 16pxに設定
                                            },
                                        }}
                                        onChange={(event) => setEncryptKey(event.currentTarget.value)}
                                    />
                                    {/[ \t\r\n\u3000]/.test(encryptKey) && <p className="text-red-500">{locale.CreatePost_PasswordErrorSpace}</p>}
                                </div>
                            }
                        </div>


                        {!prevBlur && (
                            <div className="mb-2">
                                <div className='mt-4 mb-2'>{locale.CreatePost_ThreadGateTitle}</div>
                                <div className="block text-sm text-gray-400 mt-1 mb-2">
                                    {locale.CreatePost_ThreadGateDescription}
                                </div>

                                <Chip.Group
                                    multiple
                                    value={threadGate}
                                    onChange={setThreadGate}
                                >
                                    <Group gap="xs" mt="sm">
                                        <Chip value={THREADGATE_MENTION} size="sm" variant="outline">{locale.CreatePost_ThreadGateMention}</Chip>
                                        <Chip value={THREADGATE_FOLLOWING} size="sm" variant="outline">{locale.CreatePost_ThreadGateFollowing}</Chip>
                                        <Chip value={THREADGATE_FOLLOWERS} size="sm" variant="outline">{locale.CreatePost_ThreadGateFollowers}</Chip>
                                        <Chip value={THREADGATE_QUOTE_ALLOW} size="sm" variant="outline">{locale.CreatePost_ThreadGateQuoteAllow}</Chip>
                                    </Group>
                                </Chip.Group>
                            </div>
                        )}

                        <div className="flex justify-center gap-4 mb-2 mt-6">
                            {!warning && (
                                (isReply && replyPost) || !isReply
                            ) && (

                                    <Button
                                        onClick={handleCrearePost}
                                        loaderProps={{ type: 'dots' }}
                                        disabled={isLoading || postText.length === 0 || (isEncrypt && encryptKey.length === 0) || /[ \t\r\n\u3000]/.test(encryptKey)}
                                        loading={isLoading}
                                    >
                                        {isLoading &&
                                            <span className="animate-spin inline-block size-4 mr-2 border-[3px] border-current border-t-transparent text-gray-700 rounded-full" role="status" aria-label="loading">
                                                <span className="sr-only">Loading...</span>
                                            </span>
                                        }
                                        {buttonName}
                                    </Button>
                                )}
                        </div>
                    </>
                }

            </div >
        </>
    )
}