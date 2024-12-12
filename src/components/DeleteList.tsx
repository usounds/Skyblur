
import { Agent } from '@atproto/api'
import { useState, useEffect } from "react";
import { COLLECTION, PostForDelete, PostData } from "@/types/types"
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
    const [isDeleteing, setIsDeleting] = useState<boolean>(false)
    const [selectedItem, setSelectedItem] = useState<PostForDelete | null>(null);
    const [duplicate, setDuplicate] = useState<boolean>(false);

    const getPosts = async (did: string, cursor: string) => {

        if (duplicate) {
            return;
        }
        setDuplicate(true); // 重複実行を防ぐ

        setIsLoading(true)
        setDeleteList([])
        //console.log('call');
        let deleteList: any[] = []; // 初期化
        try {
            const param = {
                repo: did,
                collection: COLLECTION,
                cursor: cursor,
                limit: 10
            };

            const bookMark = await agent.com.atproto.repo.listRecords(param);

            // 新しいカーソルを設定
            setCursor(bookMark.data.cursor || '');

            // records を処理して deleteList を更新
            for (let obj of bookMark.data.records) {
                const value = obj.value as PostData;
                deleteList.push({
                    text: value.text,
                    postATUri: obj.uri,
                    blurATUri: value.uri,
                    createdAt: formatDateToLocale(value.createdAt),
                    postURL: transformUrl(value.uri),
                    blurURL: transformUrl(obj.uri),
                });
            }

            // setDeleteList を呼び出して UI を更新
            setDeleteList(deleteList);
            setIsLoading(false);
            setDuplicate(false); // 重複実行を防ぐ

        } catch (error) {
            console.error('Error fetching bookmarks:', error);
        }
    };

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
        setIsDeleting(true)
        try {
            // 非同期操作を待つ
            await deleteRecord(selectedItem?.postATUri || '')
            await deleteRecord(selectedItem?.blurATUri || '')
        } catch (e) {
            // エラーハンドリング
            console.error("エラーが発生しました:", e);
            setIsDeleting(false)
            return
        }
        // 実際の削除処理をここに追加
        console.log("削除されました:", selectedItem);
        if (selectedItem) {
            setDeleteList(prevList => prevList.filter(item => item.blurATUri !== selectedItem.blurATUri));
        }
        setSelectedItem(null); // ダイアログを閉じる
        setIsDeleting(false)

    };

    const transformUrl = (inputUrl: string): string => {

        const parts = inputUrl.split('/');

        if (parts[3] === 'app.bsky.feed.post') {
            return `https://bsky.app/profile/${parts[2]}/post/${parts[4]}`;
        }

        if (parts[3] === 'uk.skyblur.post') {
            return `https://${window.location.hostname}/post/${parts[2]}/${parts[4]}`;
        }

        return ''
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

    let useEffectDuplidate = false

    useEffect(() => {
        if (useEffectDuplidate) return
        useEffectDuplidate = true
        // fetchBookmarks を呼び出す
        console.log('useEffect')

        getPosts(did, cursor);

        // 実行後、duplicate を再度 false に設定
        setDuplicate(false);

    }, [did]); // `did` または `cursor` が変更された場合に再実行

    return (
        <>
            <div className="max-w-screen-sm">
                {!isLoading &&
                    <div className="flex flex-wrap mb-2 justify-center ">
                        {(deleteList.length > 0) && <p className="text-m text-gray-800">{locale.DeleteList_ChooseDeleteItem}</p>}
                        {(deleteList.length === 0) && <p className="text-m text-gray-800">{locale.DeleteList_NoListItem}</p>}
                    </div>
                }
                <div className="flex flex-wrap justify-center max-w-screen-sm ">

                    {deleteList.map((item, index) => (
                        <div
                            key={index}
                            className="py-3 px-2 mb-2 mx-2 bg-white rounded-md border border-gray-400 w-full "
                        >
                            <div>
                                <PostTextWithBold postText={item.text} isValidateBrackets={true}/>
                            </div>
                            <div className="flex justify-between gap-2 mt-2">
                                <div className="text-sm text-gray-400">{item.createdAt}</div>
                                <div className="flex gap-2">
                                    <div className="text-sm text-red-500 mx-3" onClick={() => handleSelectItem(item)}>
                                        <img
                                            src="https://backet.skyblur.uk/trash.svg" // public フォルダ内のファイルは / からの相対パスで指定
                                            alt="Trash Icon"
                                            width={20} // 必要に応じて幅を指定
                                            height={20} // 必要に応じて高さを指定
                                        />
                                    </div>
                                    <a className="text-sm text-gray-500 mx-3" href={item.blurURL} target="_blank">
                                        <img
                                            src="https://backet.skyblur.uk/export-arrow-up-right.svg" // public フォルダ内のファイルは / からの相対パスで指定
                                            alt="Export Icon"
                                            width={20} // 必要に応じて幅を指定
                                            height={20} // 必要に応じて高さを指定
                                        />
                                    </a>
                                    <a className="text-sm text-gray-500 mx-3" href={item.postURL} target="_blank">
                                        <img
                                            src="https://backet.skyblur.uk/bluesky-brands-solid.svg" // public フォルダ内のファイルは / からの相対パスで指定
                                            alt="Bluesky Icon"
                                            width={20} // 必要に応じて幅を指定
                                            height={20} // 必要に応じて高さを指定
                                        />
                                    </a>
                                </div>
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
                                        disabled={isDeleteing}
                                    >
                                        {locale.DeleteList_DeleteButton}
                                    </button>
                                    <button
                                        className="px-4 py-2 bg-gray-300 disabled:bg-gray-100 text-gray-800 rounded-md"
                                        onClick={handleCloseOverlay} // 閉じる処理
                                        disabled={isDeleteing}
                                    >
                                        {locale.DeleteList_CancelButton}
                                    </button>
                                </div>
                                <PostTextWithBold postText={selectedItem.text}isValidateBrackets={true}/>
                            </div>
                        </div>
                    )}
                </div>

                {deleteList.length == 10 &&
                    <div className="flex justify-center gap-4 mt-6">
                        <button disabled={isLoading} onClick={() => getPosts(did, cursor)} className="relative z-0 h-12 rounded-full bg-gray-500 disabled:bg-gray-300 px-6 text-neutral-50 after:absolute after:left-0 after:top-0 after:-z-10 after:h-full after:w-full after:rounded-full after:bg-gray-500 hover:after:scale-x-125 hover:after:scale-y-150 hover:after:opacity-0 hover:after:transition hover:after:duration-500">
                            {isLoading ? <>{locale.DeleteList_Loading}</> : <>{locale.DeleteList_ReadMore}</>}
                        </button>

                    </div>
                }

                {(deleteList.length != 10) &&
                    <div className="flex justify-center gap-4 mt-6">
                        <button disabled={isLoading} onClick={() => getPosts(did, '')} className="relative z-0 h-12 rounded-full bg-gray-500 px-6 disabled:bg-gray-300 text-neutral-50 after:absolute after:left-0 after:top-0 after:-z-10 after:h-full after:w-full after:rounded-full after:bg-gray-500 hover:after:scale-x-125 hover:after:scale-y-150 hover:after:opacity-0 hover:after:transition hover:after:duration-500">
                            {isLoading ? <>{locale.DeleteList_Loading}</> : <>{locale.DeleteList_ToHead}</>}
                        </button>

                    </div>
                }

            </div>
        </>)
}