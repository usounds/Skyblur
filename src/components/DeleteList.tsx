
import { Agent, RichText, AppBskyFeedPost, AppBskyActorDefs } from '@atproto/api'
import { useState, useEffect } from "react";
import { COLLECTION, PostForDelete, PostData } from "../types/types"
import PostTextWithBold from "./PostTextWithBold"

type DeleteListProps = {
    agent: Agent;
    locale: any,
    did: string
};

export const DeleteList: React.FC<DeleteListProps> = ({
    agent,
    locale,
    did
}) => {
    const [cursor, setCursor] = useState("");
    const [deleteList, setDeleteList] = useState<PostForDelete[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const [selectedItem, setSelectedItem] = useState<PostForDelete | null>(null);

    let duplicate = false

    // 投稿をタップした時に選択する関数
    const handleSelectItem = (item: PostForDelete) => {
        setSelectedItem(item);
    };

    // 削除確認ダイアログを閉じる関数
    const handleCloseOverlay = () => {
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
        const param = convertAtUrlToObject(aturi)
        await agent.com.atproto.repo.deleteRecord(param)

    }

    // 投稿を削除する関数
    const handleDeleteItem = async () => {
        setIsLoading(true)
        try {
            // 非同期操作を待つ
            await deleteRecord(selectedItem?.postATUri || '')
            await deleteRecord(selectedItem?.blurATUri || '')
        } catch (e) {
            // エラーハンドリング
            console.error("エラーが発生しました:", e);
            setIsLoading(false)
            return
        }
        // 実際の削除処理をここに追加
        console.log("削除されました:", selectedItem);
        if (selectedItem) {
            setDeleteList(prevList => prevList.filter(item => item.blurATUri !== selectedItem.blurATUri));
        }
        setSelectedItem(null); // ダイアログを閉じる
        setIsLoading(false)

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
        if (duplicate) {
            return
        }
        duplicate = true
        const fetchBookmarks = async () => {
            console.log('call')
            let cursor = ''
            try {
                const param = {
                    repo: did,
                    collection: COLLECTION,
                    cursor: cursor,
                    limit: 50
                };

                const bookMark = await agent.com.atproto.repo.listRecords(param);

                setCursor(bookMark.data.cursor || '')

                for (let obj of bookMark.data.records) {
                    const value = obj.value as PostData
                    deleteList.push({
                        text: value.text,
                        postATUri: obj.uri,
                        blurATUri: value.uri,
                        createdAt: formatDateToLocale(value.createdAt)
                    }
                    )

                }

                setDeleteList(deleteList)
                setIsLoading(false)

                duplicate = false

            } catch (error) {
                console.error('Error fetching bookmarks:', error);
            }
        };

        fetchBookmarks(); // 非同期関数を呼び出す
    }, [did]); // `did` または `cursor` が変更された場合に再実行

    return (
        <>
            <div>
                <div className="flex flex-wrap gap-2 mb-2 justify-center w-full">
                    {(!isLoading && deleteList.length > 0) && <p className="text-m text-gray-800">{locale.DeleteList_ChooseDeleteItem}</p>}
                    {(!isLoading && deleteList.length === 0) && <p className="text-m text-gray-800">{locale.DeleteList_NoListItem}</p>}
                </div>
                <div className="flex flex-wrap gap-2 justify-center w-full">
                    {(isLoading && deleteList.length === 0) &&
                        <>
                            <span className="animate-spin inline-block size-4 mr-2 border-[3px] border-current border-t-transparent text-gray-700 rounded-full" role="status" aria-label="loading">
                                <span className="sr-only">Loading...</span>
                            </span>
                        </>
                    }

                    {deleteList.map((item, index) => (
                        <div
                            key={index}
                            className="w-[300px] py-3 px-2 bg-white rounded-md border border-gray-400"
                            onClick={() => handleSelectItem(item)}
                        >
                            <div>
                                <p className="text-sm text-gray-400">{item.createdAt}</p>
                                <PostTextWithBold postText={item.text} />
                            </div>
                        </div>
                    ))}


                    {/* オーバーレイ: 削除確認メッセージ */}
                    {selectedItem && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 border border-gray-800">
                            <div className="bg-white p-6 rounded-md text-center w-80">
                                <p className="text-gray-600 mb-4">{locale.DeleteList_ConfirmDelete}</p>
                                <div className="flex justify-around mb-4">
                                    <button
                                        className="px-4 py-2 bg-red-600 disabled:bg-red-100 text-white rounded-md"
                                        onClick={handleDeleteItem} // 削除処理
                                        disabled={isLoading}
                                    >
                                        {locale.DeleteList_DeleteButton}
                                    </button>
                                    <button
                                        className="px-4 py-2 bg-gray-300 disabled:bg-gray-100 text-gray-800 rounded-md"
                                        onClick={handleCloseOverlay} // 閉じる処理
                                        disabled={isLoading}
                                    >
                                        {locale.DeleteList_CancelButton}
                                    </button>
                                </div>
                                <PostTextWithBold postText={selectedItem.text} />
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </>)
}