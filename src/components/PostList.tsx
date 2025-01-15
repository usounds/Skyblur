import { DeleteModal } from "@/components/DeleteModal";
import PostListLoading from "@/components/PostListLoading";
import PostTextWithBold from "@/components/PostTextWithBold";
import { transformUrl } from "@/logic/HandleBluesky";
import { formatDateToLocale } from "@/logic/LocaledDatetime";
import { useLocaleStore } from "@/state/Locale";
import { POST_COLLECTION, PostData, PostListItem } from "@/types/types";
import { Agent, AtpAgent } from '@atproto/api';
import Link from 'next/link';
import { Button,Divider, IconButton, useNotification } from 'reablocks';
import { useEffect, useState } from "react";
import { FiEdit } from "react-icons/fi";
import { LuClipboardCheck, LuTrash2 } from "react-icons/lu";
import { FaRegArrowAltCircleRight } from "react-icons/fa";

type PostListProps = {
    handleEdit: ((input: PostListItem) => void) | null;
    agent: AtpAgent | Agent;
    did: string | null
};

export const PostList: React.FC<PostListProps> = ({
    handleEdit,
    agent,
    did
}) => {
    const [cursor, setCursor] = useState("");
    const [deleteList, setDeleteList] = useState<PostListItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const [selectedItem, setSelectedItem] = useState<PostListItem | null>(null);
    //const did = useAtpAgentStore((state) => state.did);
    //  const agent = useAtpAgentStore((state) => state.agent);
    const locale = useLocaleStore((state) => state.localeData);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { notifySuccess, notifyError } = useNotification();

    const getPosts = async (cursor: string) => {
        if (!agent) {
            console.error("未ログインです")
            return
        }

        setIsLoading(true)
        setDeleteList([])
        const deleteList: PostListItem[] = []; // 初期化
        try {
            const param = {
                repo: did || agent.assertDid,
                collection: POST_COLLECTION,
                cursor: cursor,
                limit: 10
            };

            const bookMark = await agent.com.atproto.repo.listRecords(param);

            // 新しいカーソルを設定
            if (bookMark.data.records.length === 10) {
                setCursor(bookMark.data.cursor || '');
            } else {
                setCursor('');

            }

            // records を処理して deleteList を更新
            for (const obj of bookMark.data.records) {
                const value = obj.value as PostData;
                deleteList.push({
                    blurATUri: obj.uri,
                    blur: value,
                    postURL: transformUrl(value.uri),
                    blurURL: transformUrl(obj.uri),
                    modal: false,
                    isDetailDisplay: false,
                });
            }
            // createdAtで降順ソート
            deleteList.sort((a, b) => {
                return new Date(b.blur.createdAt).getTime() - new Date(a.blur.createdAt).getTime();
            });

            // setDeleteList を呼び出して UI を更新
            setDeleteList(deleteList);
            setIsLoading(false);

        } catch (error) {
            console.error('Error fetching bookmarks:', error);
        }
    };

    // 投稿をタップした時に選択する関数
    const handleSelectItem = (item: PostListItem) => {
        setIsModalOpen(true)
        setSelectedItem(item);
    };


    const handleCopyToClipboard = async (item: PostListItem) => {
        try {
            if (item.blurURL) {
                await navigator.clipboard.writeText(item.blurURL);
                notifySuccess(locale.DeleteList_URLCopy); // 通知関数を呼び出す
            } else {
                console.error('URLが無効です');
            }
        } catch (error) {
            console.error('クリップボードへのコピーに失敗しました', error);
        }
    };

    // 削除確認ダイアログを閉じる関数
    const handleCloseOverlay = (isDeleted: boolean) => {
        if (isDeleted && selectedItem) {
            setIsModalOpen(false)
            setDeleteList(prevList => prevList.filter(item => item.blurATUri !== selectedItem.blurATUri));
        }

        setSelectedItem(null);
    };

    const convertAtUrlToObject = (atUrl: string) => {
        const regex = /^at:\/\/(?<repo>did:[a-z]+:[\w\d]+)\/(?<collection>[\w.]+)\/(?<rkey>[\w\d]+)/;
        const match = atUrl.match(regex);

        if (match && match.groups) {
            const { repo, collection, rkey } = match.groups;
            return {
                repo,
                collection,
                rkey
            };
        }

        throw new Error("Invalid URL format");
    };

    const deleteRecord = async (aturi: string) => {
        if (!agent) {
            console.error("未ログインです")
            return
        }

        const param = convertAtUrlToObject(aturi)
        await agent.com.atproto.repo.deleteRecord(param)

    }

    // 投稿を削除する関数
    const handleDeleteItem = async () => {
        try {
            // 非同期操作を待つ
            await deleteRecord(selectedItem?.blur.uri || '')
            await deleteRecord(selectedItem?.blurATUri || '')
        } catch (e) {
            // エラーハンドリング
            console.error("エラーが発生しました:", e);
            notifyError('Error:' + e)
            return
        }
        // 実際の削除処理をここに追加
        notifySuccess(locale.DeleteList_Complete)
        console.log("削除されました:", selectedItem);

    };

    useEffect(() => {
        getPosts(cursor);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleDisplay = (item: PostListItem) => {
        console.log("handleDisplay");

        const updatedList = deleteList.map((currentItem) =>
            currentItem === item
                ? { ...currentItem, isDetailDisplay: !currentItem.isDetailDisplay }
                : currentItem
        );

        setDeleteList(updatedList);
    };


    return (
        <>
            <div className="max-w-screen-sm">
                <div className="flex flex-wrap mb-2 justify-center ">
                    {(!isLoading && deleteList.length > 0) && <p className="text-m text-gray-800">{locale.DeleteList_ChooseDeleteItem}</p>}
                    {(!isLoading && deleteList.length === 0) && <p className="text-m text-gray-800">{locale.DeleteList_NoListItem}</p>}
                    {(isLoading) && <p className="text-m text-gray-800">{locale.DeleteList_Loading}</p>}
                </div>
                {isLoading ?
                    <PostListLoading />
                    :
                    <></>
                }
                <div className="flex flex-wrap justify-center max-w-screen-sm ">

                    {deleteList.map((item, index) => (
                        <div
                            key={index}
                            className="py-3 px-2 mb-2 mx-2 bg-white rounded-md border border-gray-400 w-full "
                        >
                            <div onClick={() => handleDisplay(item)}>
                                {item.isDetailDisplay ? (
                                    <>
                                        <PostTextWithBold
                                            postText={item.blur.text}
                                            isValidateBrackets={true}
                                            isMask={null}
                                        />
                                        {item.blur.additional && (
                                            <div>
                                                <Divider variant="secondary" />
                                                <PostTextWithBold
                                                    postText={item.blur.additional}
                                                    isValidateBrackets={false}
                                                    isMask={null}
                                                />
                                            </div>
                                        )}
                                    </>
                                ) : handleEdit ? (
                                    <PostTextWithBold
                                        postText={item.blur.text}
                                        isValidateBrackets={true}
                                        isMask={null}
                                    />
                                ) : (
                                    <PostTextWithBold
                                        postText={item.blur.text}
                                        isValidateBrackets={true}
                                        isMask={locale.CreatePost_OmmitChar}
                                    />
                                )}

                            </div>

                            <div className="flex justify-between gap-2 mt-2 items-end ">
                                <div className="text-sm text-gray-400 sm:text-base">
                                    {formatDateToLocale(item.blur.createdAt)}
                                </div>
                                <div className="flex sm:gap-4 gap-2">
                                    {handleEdit &&
                                        <>
                                            <IconButton size="small" variant="text" onClick={() => handleSelectItem(item)}>
                                                <LuTrash2
                                                    size={20} color="gray"
                                                />
                                            </IconButton>
                                            <IconButton size="small" variant="text" onClick={() => handleEdit(item)} >
                                                <FiEdit
                                                    size={20} color="gray"
                                                />
                                            </IconButton>
                                            <IconButton size="small" variant="text" onClick={() => handleCopyToClipboard(item)} >
                                                <LuClipboardCheck
                                                    size={20} color="gray"
                                                />
                                            </IconButton>
                                        </>
                                    }

                                    {handleEdit &&
                                        <IconButton size="small" variant="text">
                                            <Link href={`${item.blurURL || ''}?q=preview`}>
                                                <FaRegArrowAltCircleRight
                                                    size={20} color="gray"
                                                />
                                            </Link>
                                        </IconButton>
                                    }

                                    {handleEdit &&
                                        <IconButton size="small" variant="text"  >
                                            <a href={item.postURL} target="_blank" className="text-gray-500">
                                                <svg width="24" height="24" viewBox="0 0 1452 1452" xmlns="http://www.w3.org/2000/svg"><path d="M725.669,684.169c85.954,-174.908 196.522,-329.297 331.704,-463.171c45.917,-43.253 98.131,-74.732 156.638,-94.443c80.779,-23.002 127.157,10.154 139.131,99.467c-2.122,144.025 -12.566,287.365 -31.327,430.015c-29.111,113.446 -96.987,180.762 -203.629,201.947c-36.024,5.837 -72.266,8.516 -108.726,8.038c49.745,11.389 95.815,32.154 138.21,62.292c77.217,64.765 90.425,142.799 39.62,234.097c-37.567,57.717 -83.945,104.938 -139.131,141.664c-82.806,48.116 -154.983,33.716 -216.529,-43.202c-28.935,-38.951 -52.278,-81.818 -70.026,-128.603c-12.177,-34.148 -24.156,-68.309 -35.935,-102.481c-11.779,34.172 -23.757,68.333 -35.934,102.481c-17.748,46.785 -41.091,89.652 -70.027,128.603c-61.545,76.918 -133.722,91.318 -216.529,43.202c-55.186,-36.726 -101.564,-83.947 -139.131,-141.664c-50.804,-91.298 -37.597,-169.332 39.62,-234.097c42.396,-30.138 88.466,-50.903 138.21,-62.292c-36.46,0.478 -72.702,-2.201 -108.725,-8.038c-106.643,-21.185 -174.519,-88.501 -203.629,-201.947c-18.762,-142.65 -29.205,-285.99 -31.328,-430.015c11.975,-89.313 58.352,-122.469 139.132,-99.467c58.507,19.711 110.72,51.19 156.637,94.443c135.183,133.874 245.751,288.263 331.704,463.171Z" fill="currentColor" /></svg>
                                            </a>
                                        </IconButton>
                                    }
                                </div>
                            </div>
                        </div>

                    ))}

                </div>


                {isModalOpen && selectedItem &&
                    <DeleteModal content={selectedItem.blur.text} onConfirm={handleDeleteItem} onClose={handleCloseOverlay} />

                }

                {!isLoading &&
                    <div className="flex justify-center gap-4 mt-6">
                        <Button color="secondary" size="large" className="text-white text-base font-normal" disabled={isLoading} onClick={() => getPosts(cursor)} >
                            {deleteList.length == 10 ? locale.DeleteList_ReadMore : locale.DeleteList_ToHead}
                        </Button>
                    </div>
                }

            </div >
        </>)
}