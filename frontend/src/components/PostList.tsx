"use client";
import DropdownMenu from "@/components/DropdownMenu";
import PostTextWithBold from "@/components/PostTextWithBold";
import Reaction from "@/components/Reaction";
import { UkSkyblurPost, UkSkyblurPostDecryptByCid } from '@/lexicon/UkSkyblur';
import { transformUrl } from "@/logic/HandleBluesky";
import { formatDateToLocale } from "@/logic/LocaledDatetime";
import { useLocale } from "@/state/Locale";
import { useXrpcAgentStore } from "@/state/XrpcAgent";
import { PostListItem, SKYBLUR_POST_COLLECTION, VISIBILITY_LOGIN, VISIBILITY_PASSWORD } from "@/types/types";
import { Client } from '@atcute/client';
import { ActorIdentifier } from '@atcute/lexicons/syntax';
import { ActionIcon, Box, Button, Divider, Group, Input, Text, Timeline, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useState, useRef } from "react";
import { Lock, LockOpen, LogIn, X, Globe } from 'lucide-react';
import { BlueskyIcon } from './Icons';
import Loading from './Loading';

type PostListProps = {
    handleEdit: ((input: PostListItem) => void) | null;
    agent: Client;
    did: string;
    pds: string | null;
};

export const PostList: React.FC<PostListProps> = ({
    handleEdit,
    agent,
    did,
    pds
}) => {
    const [cursor, setCursor] = useState("");
    const [deleteList, setDeleteList] = useState<PostListItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const { localeData: locale } = useLocale();
    const setIsLoginModalOpened = useXrpcAgentStore((state) => state.setIsLoginModalOpened);
    const loginDid = useXrpcAgentStore((state) => state.did);
    const [isDecrypting, setIsDecrypting] = useState<boolean>(false)
    const [isLast, setIsLast] = useState<boolean>(false)

    const isMounted = useRef(true);
    const observerTarget = useRef<HTMLDivElement>(null);

    const getPosts = async (currentCursor: string, isInitial: boolean = false) => {
        if (!agent || !did) {
            return;
        }

        setIsLoading(true)
        const deleteListLocal: PostListItem[] = [];
        try {
            const param = {
                repo: did as ActorIdentifier,
                collection: SKYBLUR_POST_COLLECTION as `${string}.${string}.${string}`,
                cursor: currentCursor,
                limit: 10
            };

            const result = await agent.get(`com.atproto.repo.listRecords`, {
                params: param
            });

            if (!result.ok || !isMounted.current) {
                return;
            }

            if (result.data.records.length === 0) {
                setIsLast(true)
            }

            setCursor(result.data.cursor || '');

            // records を処理して deleteList を更新
            for (const obj of result.data.records) {
                const value = obj.value as unknown as UkSkyblurPost.Record;
                deleteListLocal.push({
                    blurATUri: obj.uri,
                    blur: value,
                    postURL: transformUrl(value.uri),
                    blurURL: transformUrl(obj.uri),
                    modal: false,
                    isDetailDisplay: false,
                    isDecrypt: false
                });
            }
            // createdAtで降順ソート
            deleteListLocal.sort((a, b) => {
                return new Date(b.blur.createdAt).getTime() - new Date(a.blur.createdAt).getTime();
            });

            // setDeleteList を呼び出して UI を更新
            if (isInitial) {
                setDeleteList(deleteListLocal);
            } else {
                setDeleteList(prev => [...prev, ...deleteListLocal]);
            }

        } catch (error) {
            console.error('PostList: Error fetching records:', error);
        } finally {
            if (isMounted.current) {
                setIsLoading(false);
            }
        }
    };

    const isSessionChecked = useXrpcAgentStore(state => state.isSessionChecked);

    useEffect(() => {
        isMounted.current = true;
        if (did && agent && isSessionChecked) {
            setDeleteList([]);
            setCursor("");
            setIsLast(false);

            // 引数で初期読み込みであることを伝える
            getPosts("", true);
        }
        return () => {
            isMounted.current = false;
        };
    }, [did, agent, isSessionChecked]);

    useEffect(() => {
        const target = observerTarget.current;
        if (!target || isLoading || isLast) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !isLoading && !isLast) {
                    getPosts(cursor);
                }
            },
            { threshold: 1.0 }
        );

        observer.observe(target);

        return () => {
            if (target) {
                observer.unobserve(target);
            }
        };
    }, [cursor, isLoading, isLast]);

    const handleDisplay = async (item: PostListItem) => {
        if (!item.isDecrypt && item.blur?.visibility === VISIBILITY_PASSWORD) {
            return
        }
        if (item.blur?.visibility === VISIBILITY_LOGIN && !loginDid) {
            setIsLoginModalOpened(true);
            return
        }

        const updatedList = deleteList.map((currentItem) =>
            currentItem === item
                ? { ...currentItem, isDetailDisplay: !currentItem.isDetailDisplay }
                : currentItem
        );

        setDeleteList(updatedList);
    };


    const setEncryptKey = (value: string, targetItem: typeof deleteList[number]) => {
        setDeleteList(prevList =>
            prevList.map(item =>
                item === targetItem ? { ...item, encryptKey: value } : item
            )
        );
    };

    const handleDecrypt = async (item: typeof deleteList[number]) => {
        if (!item.encryptKey) {
            notifications.show({
                title: 'Error',
                message: locale.DeleteList_DecryptRequired,
                color: 'red',
                icon: <X />
            });
            return
        }
        setIsDecrypting(true)
        notifications.show({
            title: locale.DeleteList_DecryptButton,
            loading: true,
            autoClose: false,
            message: locale.Post_DecryptInProgress,
            icon: <X />
        });

        try {
            const host = window.location.host;
            let apiHost = 'api.skyblur.uk'
            if (host.includes('dev.skyblur.uk') || host.includes('localhost')) {
                apiHost = 'devapi.skyblur.uk'
            }

            const repo = Array.isArray(did) ? did[0] : did || ''
            if (!repo.startsWith('did:')) return
            const validRepo = repo as `did:${string}:${string}`

            const decryptByCidBody: any = {
                repo: validRepo,
                cid: item.blur.encryptBody?.ref.$link || '',
                password: item.encryptKey,
            }
            const response = await fetch(`https://${apiHost}/xrpc/uk.skyblur.post.decryptByCid`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: 'include',
                body: JSON.stringify(decryptByCidBody)
            });

            if (response.ok) {
                const data: UkSkyblurPostDecryptByCid.Output = await response.json()
                notifications.clean()
                setDeleteList((prevList) =>
                    prevList.map((listItem) =>
                        listItem.blurATUri === item.blurATUri
                            ? {
                                ...listItem,
                                blur: {
                                    ...listItem.blur,
                                    text: data.text,
                                    additional: data.additional,
                                },
                                isDecrypt: true,
                                isDetailDisplay: true,
                            }
                            : listItem
                    )
                );

            } else {
                if (response.status == 403) {
                    notifications.clean()
                    notifications.show({
                        title: 'Error',
                        message: locale.DeleteList_DecryptErrorMessage,
                        color: 'red',
                        icon: <X />
                    });
                } else {
                    const data = await response.json() as { message: string }
                    notifications.clean()
                    notifications.show({
                        title: 'Error',
                        message: data.message,
                        color: 'red',
                        icon: <X />
                    });
                }
            }
        } catch (e) {
            notifications.clean()
            notifications.show({
                title: 'Error',
                message: 'Message:' + e,
                color: 'red',
                icon: <X />
            });
        }

        setIsDecrypting(false)

    }


    return (
        <>
            <div className="max-w-screen-sm">
                {deleteList.length > 0 && <Text ta="center">{locale.DeleteList_ChooseDeleteItem}</Text>}

                {/* 初期読み込み中のローダー */}
                {isLoading && deleteList.length === 0 && <Loading />}

                {(!isLoading && deleteList.length === 0) && <Text ta="center">{locale.DeleteList_NoListItem}</Text>}

                <Timeline bulletSize={20} lineWidth={2} mx="sm" mt='sm'>
                    {deleteList.map((item, index) => (
                        <Timeline.Item
                            key={index}
                            bullet={
                                (() => {
                                    if (item.blur?.visibility === VISIBILITY_PASSWORD) {
                                        return (
                                            <Tooltip label={locale.Visibility_Password} withArrow position="right">
                                                {item.isDecrypt ? <LockOpen size={14} /> : <Lock size={14} />}
                                            </Tooltip>
                                        );
                                    }
                                    if (item.blur?.visibility === VISIBILITY_LOGIN) {
                                        return (
                                            <Tooltip label={locale.Visibility_Login} withArrow position="right">
                                                <LogIn size={14} />
                                            </Tooltip>
                                        );
                                    }
                                    return (
                                        <Tooltip label={locale.Visibility_Public} withArrow position="right">
                                            <Globe size={14} />
                                        </Tooltip>
                                    );
                                })()
                            }
                        >
                            {/* 本文 */}
                            <Box onClick={() => handleDisplay(item)}>
                                {item.blur?.visibility === VISIBILITY_LOGIN && !loginDid && !handleEdit ? (
                                    <div className="p-2 text-sm text-gray-500 italic">
                                        {locale.PostList_NeedLoginMessage}
                                    </div>
                                ) : (
                                    <>
                                        {item.isDetailDisplay ? (
                                            <>
                                                <PostTextWithBold
                                                    postText={item.blur.text}
                                                    isValidateBrackets
                                                    isMask={null}
                                                />
                                                {item.blur.additional && (
                                                    <Box>
                                                        <Divider my="xs" />
                                                        <PostTextWithBold
                                                            postText={item.blur.additional}
                                                            isValidateBrackets={false}
                                                            isMask={null}
                                                        />
                                                    </Box>
                                                )}
                                            </>
                                        ) : handleEdit ? (
                                            <PostTextWithBold
                                                postText={item.blur.text}
                                                isValidateBrackets
                                                isMask={null}
                                            />
                                        ) : (
                                            <PostTextWithBold
                                                postText={item.blur.text}
                                                isValidateBrackets
                                                isMask={locale.CreatePost_OmmitChar}
                                            />
                                        )}
                                    </>
                                )}
                            </Box>

                            {/* 下部アイコン行 */}
                            <Group justify="space-between" align="flex-end">
                                <Group gap="xs">
                                    <Text size="sm" c="gray">
                                        {formatDateToLocale(item.blur.createdAt)}
                                    </Text>
                                    {item.isDetailDisplay && (
                                        <Box ml="md">
                                            <Reaction
                                                atUriPost={item.blur.uri}
                                                atUriBlur={item.blurATUri}
                                            />
                                        </Box>
                                    )}
                                </Group>

                                <Group gap="sm" ml='sm'>
                                    {handleEdit && (
                                        <DropdownMenu
                                            post={item}
                                            handleEdit={handleEdit}
                                            agent={agent}
                                            did={did}
                                            setDeleteList={setDeleteList}
                                        />
                                    )}
                                    {!handleEdit && (
                                        <ActionIcon
                                            variant="subtle"
                                            component="a"
                                            href={item.postURL}
                                            target="_blank"
                                            c="gray"
                                        >
                                            {/* アイコンSVGは元のまま流用 */}
                                            <BlueskyIcon size={22} />

                                        </ActionIcon>
                                    )}
                                </Group>
                            </Group>


                            {/* 暗号化されている場合の入力欄 */}
                            {item.blur?.visibility === VISIBILITY_PASSWORD && !item.isDecrypt && (
                                <>
                                    <Text size="sm" c="dimmed" mt="xs">
                                        {locale.DeleteList_EncryptDescription}
                                    </Text>
                                    <Group justify="center" gap="sm" mt="xs">
                                        <Input
                                            value={item.encryptKey ?? ""}
                                            size="xs"
                                            styles={{
                                                input: {
                                                    fontSize: 16,
                                                },
                                            }}
                                            onChange={(e) => setEncryptKey(e.target.value, item)}
                                        />
                                        <Button
                                            color="blue"
                                            size="xs"
                                            onClick={() => handleDecrypt(item)}
                                            loading={isDecrypting}
                                            loaderProps={{ type: 'dots' }}
                                        >
                                            {locale.DeleteList_DecryptButton}
                                        </Button>
                                    </Group>
                                </>
                            )}

                        </Timeline.Item>
                    ))}
                </Timeline>

                {!isLast && (
                    <div ref={observerTarget} className="flex justify-center h-20 items-center">
                        {isLoading && deleteList.length > 0 && <Loading />}
                    </div>
                )}

            </div >
        </>)
}