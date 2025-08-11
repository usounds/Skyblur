"use client";
import DropdownMenu from "@/components/DropdownMenu";
import PostListLoading from "@/components/PostListLoading";
import PostTextWithBold from "@/components/PostTextWithBold";
import Reaction from "@/components/Reaction";
import { UkSkyblurPost, UkSkyblurPostDecryptByCid } from '@/lexicon/UkSkyblur';
import { transformUrl } from "@/logic/HandleBluesky";
import { formatDateToLocale } from "@/logic/LocaledDatetime";
import { useLocaleStore } from "@/state/Locale";
import { PostListItem, SKYBLUR_POST_COLLECTION, VISIBILITY_PASSWORD } from "@/types/types";
import { Client } from '@atcute/client';
import { ActorIdentifier } from '@atcute/lexicons/syntax';
import { ActionIcon, Box, Button, Divider, Group, Input, Text, Timeline } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useState } from "react";
import { CiLock, CiUnlock } from "react-icons/ci";
import { HiX } from "react-icons/hi";
import { IoMdEye, IoMdEyeOff } from "react-icons/io";

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
    const locale = useLocaleStore((state) => state.localeData);
    const [isDecrypting, setIsDecrypting] = useState<boolean>(false)
    const [isLast, setIsLast] = useState<boolean>(false)

    const getPosts = async (cursor: string) => {
        if (!agent) {
            console.error("未ログインです")
            return
        }

        console.log('cursor:' + cursor)

        setIsLoading(true)
        const deleteListLocal: PostListItem[] = []; // 初期化
        try {
            const param = {
                repo: did as ActorIdentifier,
                collection: SKYBLUR_POST_COLLECTION as `${string}.${string}.${string}`,
                cursor: cursor,
                limit: 10
            };

            const result = await agent.get(`com.atproto.repo.listRecords`, {
                params: param
            });


            if (!result.ok) return
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
            setDeleteList([...deleteList, ...deleteListLocal]);
            setIsLoading(false);

        } catch (error) {
            console.error('Error fetching bookmarks:', error);
        }
    };

    useEffect(() => {
        getPosts(cursor);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleDisplay = async (item: PostListItem) => {
        if (!item.isDecrypt && item.blur?.visibility === VISIBILITY_PASSWORD) {
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
                icon: <HiX />
            });
            return
        }
        setIsDecrypting(true)
        notifications.show({
            title: locale.DeleteList_DecryptButton,
            loading: true,
            autoClose: false,
            message: locale.Post_DecryptInProgress,
            color: 'red',
            icon: <HiX />
        });

        try {
            const host = new URL(origin).host;
            let apiHost = 'api.skyblur.uk'
            if (host?.endsWith('usounds.work')) {
                apiHost = 'skyblurapi.usounds.work'
            }

            const repo = Array.isArray(did) ? did[0] : did || ''
            if (!repo.startsWith('did:')) return
            const validRepo = repo as `did:${string}`

            const decryptByCidBody: UkSkyblurPostDecryptByCid.Input = {
                pds: pds || '',
                repo: validRepo,
                cid: item.blur.encryptBody?.ref.$link || '',
                password: item.encryptKey,
            }
            const response = await fetch(`https://${apiHost}/xrpc/uk.skyblur.post.decryptByCid`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(decryptByCidBody)
            });

            if (response.ok) {
                const data: UkSkyblurPostDecryptByCid.Output = await response.json()
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
                        icon: <HiX />
                    });
                } else {
                    const data = await response.json() as { message: string }
                    notifications.clean()
                    notifications.show({
                        title: 'Error',
                        message: data.message,
                        color: 'red',
                        icon: <HiX />
                    });
                }
            }
        } catch (e) {
            notifications.clean()
            notifications.show({
                title: 'Error',
                message: 'Message:' + e,
                color: 'red',
                icon: <HiX />
            });
        }


        setIsDecrypting(false)

    }


    return (
        <>
            <div className="max-w-screen-sm">
                {(!isLoading && deleteList.length > 0) && <Text ta="center">{locale.DeleteList_ChooseDeleteItem}</Text>}
                {(!isLoading && deleteList.length === 0) && <Text ta="center">{locale.DeleteList_NoListItem}</Text>}
                {(isLoading) && <Text ta="center">{locale.DeleteList_Loading}</Text>}
                {(isLoading && deleteList.length === 0) ?
                    <PostListLoading />
                    :
                    <></>
                }

                <Timeline bulletSize={20} lineWidth={2} mx="sm" >
                    {deleteList.map((item, index) => (
                        <Timeline.Item
                            key={index}
                            bullet={
                                item.blur?.visibility === VISIBILITY_PASSWORD && (
                                    item.isDecrypt ? (
                                        <CiUnlock size={20} />
                                    ) : (
                                        <CiLock size={20} />
                                    )
                                )
                            }
                        >
                            {/* 本文 */}
                            <Box onClick={() => handleDisplay(item)}>
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
                            </Box>

                            {/* 下部アイコン行 */}
                            <Group justify="space-between" align="flex-end">
                                <Group gap="xs">
                                    <Text size="sm" c="dimmed">
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

                                <Group gap="sm">
                                    {handleEdit && (
                                        <DropdownMenu
                                            post={item}
                                            handleEdit={handleEdit}
                                            agent={agent}
                                            did={did}
                                            setDeleteList={setDeleteList}
                                        />
                                    )}

                                    {!handleEdit &&
                                        (item.blur?.visibility !== VISIBILITY_PASSWORD ||
                                            (item.isDecrypt &&
                                                item.blur?.visibility === VISIBILITY_PASSWORD)) && (
                                            <ActionIcon
                                                variant="subtle"
                                                onClick={() => handleDisplay(item)}
                                            >
                                                {item.isDetailDisplay ? (
                                                    <IoMdEyeOff size={22} color="gray" />
                                                ) : (
                                                    <IoMdEye size={22} color="gray" />
                                                )}
                                            </ActionIcon>
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
                                            <svg
                                                width="22"
                                                height="22"
                                                viewBox="0 0 1452 1452"
                                                xmlns="http://www.w3.org/2000/svg"
                                            >
                                                <path
                                                    d="M725.669,684.169c85.954,-174.908 196.522,-329.297 331.704,-463.171c45.917,-43.253 98.131,-74.732 156.638,-94.443c80.779,-23.002 127.157,10.154 139.131,99.467c-2.122,144.025 -12.566,287.365 -31.327,430.015c-29.111,113.446 -96.987,180.762 -203.629,201.947c-36.024,5.837 -72.266,8.516 -108.726,8.038c49.745,11.389 95.815,32.154 138.21,62.292c77.217,64.765 90.425,142.799 39.62,234.097c-37.567,57.717 -83.945,104.938 -139.131,141.664c-82.806,48.116 -154.983,33.716 -216.529,-43.202c-28.935,-38.951 -52.278,-81.818 -70.026,-128.603c-12.177,-34.148 -24.156,-68.309 -35.935,-102.481c-11.779,34.172 -23.757,68.333 -35.934,102.481c-17.748,46.785 -41.091,89.652 -70.027,128.603c-61.545,76.918 -133.722,91.318 -216.529,43.202c-55.186,-36.726 -101.564,-83.947 -139.131,-141.664c-50.804,-91.298 -37.597,-169.332 39.62,-234.097c42.396,-30.138 88.466,-50.903 138.21,-62.292c-36.46,0.478 -72.702,-2.201 -108.725,-8.038c-106.643,-21.185 -174.519,-88.501 -203.629,-201.947c-18.762,-142.65 -29.205,-285.99 -31.328,-430.015c11.975,-89.313 58.352,-122.469 139.132,-99.467c58.507,19.711 110.72,51.19 156.637,94.443c135.183,133.874 245.751,288.263 331.704,463.171Z"
                                                    fill="currentColor"
                                                />
                                            </svg>
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

                {!isLoading && !isLast &&
                    <div className="flex justify-center gap-4 mt-6">
                        <Button variant="outline" color="gray" disabled={isLoading} onClick={() => getPosts(cursor)} >
                            {locale.DeleteList_ReadMore}
                        </Button>
                    </div>
                }

            </div >
        </>)
}