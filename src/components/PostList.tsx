import PostTextWithBold from "@/components/PostTextWithBold";
import { formatDateToLocale } from "@/logic/LocaledDatetime";
import { useAtpAgentStore } from "@/state/AtpAgent";
import { useLocaleStore } from "@/state/Locale";
import { COLLECTION, PostData, PostListItem } from "@/types/types";
import Image from 'next/image';
import { useEffect, useState } from "react";
import Link from 'next/link';

type DeleteListProps = {
    handleEdit: (input: PostListItem) => void;
};

export const DeleteList: React.FC<DeleteListProps> = ({
    handleEdit
}) => {
    const [cursor, setCursor] = useState("");
    const [deleteList, setDeleteList] = useState<PostListItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const [isDeleteing, setIsDeleting] = useState<boolean>(false)
    const [selectedItem, setSelectedItem] = useState<PostListItem | null>(null);
    const [duplicate, setDuplicate] = useState<boolean>(false);
    const did = useAtpAgentStore((state) => state.did);
    const agent = useAtpAgentStore((state) => state.agent);
    const locale = useLocaleStore((state) => state.localeData);

    const getPosts = async (did: string, cursor: string) => {

        if (duplicate) {
            return;
        }
        if (!agent) {
            console.error("未ログインです")
            return
        }

        setDuplicate(true); // 重複実行を防ぐ

        setIsLoading(true)
        setDeleteList([])
        //console.log('call');
        const deleteList: any[] = []; // 初期化
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
            for (const obj of bookMark.data.records) {
                const value = obj.value as PostData;
                deleteList.push({
                    blurATUri: obj.uri,
                    blur: value,
                    postURL: transformUrl(value.uri),
                    blurURL: transformUrl(obj.uri),
                });
            }
            // createdAtで降順ソート
            deleteList.sort((a, b) => {
                return new Date(b.blur.createdAt).getTime() - new Date(a.blur.createdAt).getTime();
            });

            // setDeleteList を呼び出して UI を更新
            setDeleteList(deleteList);
            setIsLoading(false);
            setDuplicate(false); // 重複実行を防ぐ

        } catch (error) {
            console.error('Error fetching bookmarks:', error);
        }
    };

    // 投稿をタップした時に選択する関数
    const handleSelectItem = (item: PostListItem) => {
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
        if (!agent) {
            console.error("未ログインです")
            return
        }

        const param = convertAtUrlToObject(aturi)
        await agent.com.atproto.repo.deleteRecord(param)

    }

    // 投稿を削除する関数
    const handleDeleteItem = async () => {
        setIsDeleting(true)
        try {
            // 非同期操作を待つ
            await deleteRecord(selectedItem?.blur.uri || '')
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

    let useEffectDuplidate = false

    useEffect(() => {
        if (useEffectDuplidate) return
        // eslint-disable-next-line react-hooks/exhaustive-deps
        useEffectDuplidate = true
        // fetchBookmarks を呼び出す
        console.log('useEffect')

        getPosts(did, cursor);

        // 実行後、duplicate を再度 false に設定
        setDuplicate(false);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
                                <PostTextWithBold postText={item.blur.text} isValidateBrackets={true} />
                            </div>
                            <div className="flex justify-between gap-2 mt-2">
                                <div className="text-sm text-gray-400">{formatDateToLocale(item.blur.createdAt)}</div>
                                <div className="flex gap-2">
                                    <div className="text-sm text-red-500 mx-3" onClick={() => handleSelectItem(item)}>
                                        <Image
                                            src="https://backet.skyblur.uk/trash2.svg" // public フォルダ内のファイルは / からの相対パスで指定
                                            alt="Trash Icon"
                                            width={20} // 必要に応じて幅を指定
                                            height={20} // 必要に応じて高さを指定
                                        />
                                    </div>
                                    <div onClick={() => handleEdit(item)} className="text-sm text-gray-500 mx-3">
                                        <Image
                                            src="https://backet.skyblur.uk/edit.svg" // public フォルダ内のファイルは / からの相対パスで指定
                                            alt="Export Icon"
                                            width={20} // 必要に応じて幅を指定
                                            height={20} // 必要に応じて高さを指定
                                        />
                                    </div>
                                    <Link className="text-sm text-gray-500 mx-3" href={`${item.blurURL || ''}?q=preview`}>
                                        <Image
                                            src="https://backet.skyblur.uk/right-arrow.svg" // public フォルダ内のファイルは / からの相対パスで指定
                                            alt="Export Icon"
                                            width={20} // 必要に応じて幅を指定
                                            height={20} // 必要に応じて高さを指定
                                        />
                                    </Link>
                                    <a className="text-sm text-gray-600 ml-2 mr-2" href={item.postURL} target="_blank">
                                        <svg className="h-5 w-5" width="20" height="20" viewBox="0 0 1452 1452" xmlns="http://www.w3.org/2000/svg"><path d="M725.669,684.169c85.954,-174.908 196.522,-329.297 331.704,-463.171c45.917,-43.253 98.131,-74.732 156.638,-94.443c80.779,-23.002 127.157,10.154 139.131,99.467c-2.122,144.025 -12.566,287.365 -31.327,430.015c-29.111,113.446 -96.987,180.762 -203.629,201.947c-36.024,5.837 -72.266,8.516 -108.726,8.038c49.745,11.389 95.815,32.154 138.21,62.292c77.217,64.765 90.425,142.799 39.62,234.097c-37.567,57.717 -83.945,104.938 -139.131,141.664c-82.806,48.116 -154.983,33.716 -216.529,-43.202c-28.935,-38.951 -52.278,-81.818 -70.026,-128.603c-12.177,-34.148 -24.156,-68.309 -35.935,-102.481c-11.779,34.172 -23.757,68.333 -35.934,102.481c-17.748,46.785 -41.091,89.652 -70.027,128.603c-61.545,76.918 -133.722,91.318 -216.529,43.202c-55.186,-36.726 -101.564,-83.947 -139.131,-141.664c-50.804,-91.298 -37.597,-169.332 39.62,-234.097c42.396,-30.138 88.466,-50.903 138.21,-62.292c-36.46,0.478 -72.702,-2.201 -108.725,-8.038c-106.643,-21.185 -174.519,-88.501 -203.629,-201.947c-18.762,-142.65 -29.205,-285.99 -31.328,-430.015c11.975,-89.313 58.352,-122.469 139.132,-99.467c58.507,19.711 110.72,51.19 156.637,94.443c135.183,133.874 245.751,288.263 331.704,463.171Z" fill="currentColor" /></svg>
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
                                <PostTextWithBold postText={selectedItem.blur.text} isValidateBrackets={true} />
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