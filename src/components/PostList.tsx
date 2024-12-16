import { DeleteModal } from "@/components/DeleteModal";
import PostListLoading from "@/components/PostListLoading";
import PostTextWithBold from "@/components/PostTextWithBold";
import { formatDateToLocale } from "@/logic/LocaledDatetime";
import { useAtpAgentStore } from "@/state/AtpAgent";
import { useLocaleStore } from "@/state/Locale";
import { COLLECTION, PostData, PostListItem } from "@/types/types";
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from "react";

import { Button, IconButton } from 'reablocks';

type PostListProps = {
    handleEdit: (input: PostListItem) => void;
};

export const PostList: React.FC<PostListProps> = ({
    handleEdit
}) => {
    const [cursor, setCursor] = useState("");
    const [deleteList, setDeleteList] = useState<PostListItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const [selectedItem, setSelectedItem] = useState<PostListItem | null>(null);
    const did = useAtpAgentStore((state) => state.did);
    const agent = useAtpAgentStore((state) => state.agent);
    const locale = useLocaleStore((state) => state.localeData);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const getPosts = async (did: string, cursor: string) => {

        if (!agent) {
            console.error("未ログインです")
            return
        }


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
                    modal: false
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
            return
        }
        // 実際の削除処理をここに追加
        console.log("削除されました:", selectedItem);

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

    useEffect(() => {
        getPosts(did, cursor);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
                            <div>
                                <PostTextWithBold postText={item.blur.text} isValidateBrackets={true} />
                            </div>

                            <div className="flex justify-between items-center gap-2 mt-2">
                                <div className="text-sm text-gray-400">{formatDateToLocale(item.blur.createdAt)}</div>
                                <div className="flex sm:gap-6 gap-4">
                                    <IconButton size="small" variant="text" onClick={() => handleSelectItem(item)}>
                                        <Image
                                            src="https://backet.skyblur.uk/trash2.svg" // public フォルダ内のファイルは / からの相対パスで指定
                                            alt="Trash Icon"
                                            width={20} // 必要に応じて幅を指定
                                            height={20} // 必要に応じて高さを指定
                                            unoptimized
                                        />
                                    </IconButton>
                                    <IconButton size="small" variant="text" onClick={() => handleEdit(item)} >
                                        <Image
                                            src="https://backet.skyblur.uk/edit.svg" // public フォルダ内のファイルは / からの相対パスで指定
                                            alt="Export Icon"
                                            width={20} // 必要に応じて幅を指定
                                            height={20} // 必要に応じて高さを指定
                                            unoptimized
                                        />
                                    </IconButton>
                                    <IconButton size="small" variant="text"  >
                                        <Link href={`${item.blurURL || ''}?q=preview`}>
                                            <Image
                                                src="https://backet.skyblur.uk/right-arrow.svg" // public フォルダ内のファイルは / からの相対パスで指定
                                                alt="Export Icon"
                                                width={20} // 必要に応じて幅を指定
                                                height={20} // 必要に応じて高さを指定
                                                unoptimized
                                            />
                                        </Link>
                                    </IconButton>
                                    <IconButton size="small" variant="text"  >
                                        <a href={item.postURL} target="_blank">
                                            <svg width="20" height="20" viewBox="0 0 1452 1452" xmlns="http://www.w3.org/2000/svg"><path d="M725.669,684.169c85.954,-174.908 196.522,-329.297 331.704,-463.171c45.917,-43.253 98.131,-74.732 156.638,-94.443c80.779,-23.002 127.157,10.154 139.131,99.467c-2.122,144.025 -12.566,287.365 -31.327,430.015c-29.111,113.446 -96.987,180.762 -203.629,201.947c-36.024,5.837 -72.266,8.516 -108.726,8.038c49.745,11.389 95.815,32.154 138.21,62.292c77.217,64.765 90.425,142.799 39.62,234.097c-37.567,57.717 -83.945,104.938 -139.131,141.664c-82.806,48.116 -154.983,33.716 -216.529,-43.202c-28.935,-38.951 -52.278,-81.818 -70.026,-128.603c-12.177,-34.148 -24.156,-68.309 -35.935,-102.481c-11.779,34.172 -23.757,68.333 -35.934,102.481c-17.748,46.785 -41.091,89.652 -70.027,128.603c-61.545,76.918 -133.722,91.318 -216.529,43.202c-55.186,-36.726 -101.564,-83.947 -139.131,-141.664c-50.804,-91.298 -37.597,-169.332 39.62,-234.097c42.396,-30.138 88.466,-50.903 138.21,-62.292c-36.46,0.478 -72.702,-2.201 -108.725,-8.038c-106.643,-21.185 -174.519,-88.501 -203.629,-201.947c-18.762,-142.65 -29.205,-285.99 -31.328,-430.015c11.975,-89.313 58.352,-122.469 139.132,-99.467c58.507,19.711 110.72,51.19 156.637,94.443c135.183,133.874 245.751,288.263 331.704,463.171Z" fill="currentColor" /></svg>
                                        </a>
                                    </IconButton>
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
                        <Button color="secondary" className="text-white text-base font-normal" disabled={isLoading} onClick={() => getPosts(did, cursor)} >
                            {deleteList.length == 10 ? locale.DeleteList_ReadMore : locale.DeleteList_ToHead}
                        </Button>
                    </div>
                }

            </div >
        </>)
}