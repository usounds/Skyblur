import { DeleteModal } from "@/components/DeleteModal";
import PostListLoading from "@/components/PostListLoading";
import PostTextWithBold from "@/components/PostTextWithBold";
import Reaction from "@/components/Reaction";
import { transformUrl } from "@/logic/HandleBluesky";
import { formatDateToLocale } from "@/logic/LocaledDatetime";
import { useAtpAgentStore } from "@/state/AtpAgent";
import { useLocaleStore } from "@/state/Locale";
import { PostData, PostListItem, SKYBLUR_POST_COLLECTION, VISIBILITY_PASSWORD, VISIBILITY_PUBLIC } from "@/types/types";
import { Agent, AtpAgent } from '@atproto/api';
import { Button, Divider, IconButton, Input, useNotification } from 'reablocks';
import { useEffect, useState } from "react";
import { CiLock, CiUnlock } from "react-icons/ci";
import { FiEdit } from "react-icons/fi";
import { IoMdEye, IoMdEyeOff } from "react-icons/io";
import { LuClipboardCheck, LuTrash2 } from "react-icons/lu";

type PostListProps = {
    handleEdit: ((input: PostListItem) => void) | null;
    agent: AtpAgent | Agent;
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
    const [selectedItem, setSelectedItem] = useState<PostListItem | null>(null);
    const locale = useLocaleStore((state) => state.localeData);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDecrypting, setIsDecrypting] = useState<boolean>(false)
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
                repo: did,
                collection: SKYBLUR_POST_COLLECTION,
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
                    isDecrypt: false
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
    // 投稿を削除する関数
    const handleDeleteItem = async () => {
        try {
            const writes = [];

            writes.push({
                $type: 'com.atproto.repo.applyWrites#delete',
                collection: 'uk.skyblur.post',
                rkey: selectedItem?.blurATUri.split('/').pop() || '',
            })

            writes.push({
                $type: 'com.atproto.repo.applyWrites#delete',
                collection: 'app.bsky.feed.post',
                rkey: selectedItem?.blur.uri.split('/').pop() || '',
            })

            const ret = await agent.com.atproto.repo.applyWrites({
                repo: did||'',
                writes: writes
            })
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
        if(!item.encryptKey){
            setDeleteList((prevList) =>
                prevList.map((listItem) =>
                    listItem === item
                        ? {
                            ...listItem,
                            encryptMessage: locale.DeleteList_DecryptRequired
                        }
                        : listItem
                )
            );
            return
        }
        setIsDecrypting(true)

        try {

            const response = await fetch("https://api.skyblur.uk/xrpc/uk.skyblur.post.decryptByCid", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    pds: pds,
                    repo: did,
                    cid: item.blur.encryptBody?.ref.toString(),
                    password: item.encryptKey,
                })
            });

            if (response.ok) {
                const data = await response.json();
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
                                encryptMessage: ""
                            }
                            : listItem
                    )
                );
                
            } else {
                if(response.status==403){
                    setDeleteList((prevList) =>
                        prevList.map((listItem) =>
                            listItem === item
                                ? {
                                    ...listItem,
                                    encryptMessage: locale.DeleteList_DecryptErrorMessage
                                }
                                : listItem
                        )
                    );
                }else{
                    const data = await response.json() as { message: string }
                    setDeleteList((prevList) =>
                        prevList.map((listItem) =>
                            listItem === item
                                ? {
                                    ...listItem,
                                    encryptMessage: data.message
                                }
                                : listItem
                        )
                    );
                }
            }
        } catch (e) {
            setDeleteList((prevList) =>
                prevList.map((listItem) =>
                    listItem === item
                        ? {
                            ...listItem,
                            encryptMessage: 'Error:'+e
                        }
                        : listItem
                )
            );
        }


        setIsDecrypting(false)

    }


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
                            className={`relative py-3 px-2 mb-2 mx-2 rounded-md border border-gray-400 w-full ${item.blur?.visibility === VISIBILITY_PASSWORD
                                ? item.isDecrypt
                                    ? "bg-gray-100"
                                    : "bg-gray-200"
                                : "bg-white"
                                }`}
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

                            {(item.blur?.visibility === VISIBILITY_PASSWORD && !item.isDecrypt) &&
                                <>
                                    <div className="block text-sm text-gray-400 mt-1">{locale.DeleteList_EncryptDescription}</div>
                                    <div className="flex flex-row items-center justify-center m-2"> {/* Flexbox with centered alignment */}
                                        <Input value={item.encryptKey}  className='h-6'
                                            onValueChange={(value) => setEncryptKey(value, item)} />
                                        <Button
                                            color="primary"
                                            size="medium"
                                            className="text-white mx-2 h-9 font-normal"
                                            onClick={() => handleDecrypt(item)}
                                            disabled={isDecrypting}
                                        >
                                            {locale.DeleteList_DecryptButton}
                                        </Button>
                                    </div>
                                </>
                            }

                            {(item.encryptMessage) &&
                                <div className="flex justify-center">
                                    <div className="block text-sm text-red-400 my-1">{item.encryptMessage}</div>
                                </div>
                            }

                            {item.isDetailDisplay && handleEdit &&
                                <div className="mt-1">
                                    <Reaction atUriPost={item.blur.uri} atUriBlur={item.blurATUri} />
                                </div>
                            }

                            <div className="flex justify-between items-button gap-2 items-end ">
                                <div className="flex items-center gap-2">
                                    <div className="text-sm text-gray-400 flex items-center">
                                        {item.blur?.visibility === VISIBILITY_PASSWORD && (
                                            item.isDecrypt ? (
                                                <CiUnlock className="mr-1" size={16} color="gray" />
                                            ) : (
                                                <CiLock className="mr-1" size={16} color="gray" />
                                            )
                                        )}
                                        {formatDateToLocale(item.blur.createdAt)}
                                    </div>

                                    {item.isDetailDisplay && !handleEdit &&
                                        <Reaction atUriPost={item.blur.uri} atUriBlur={item.blurATUri} />
                                    }
                                </div>
                                <div className="flex sm:gap-6 gap-3">
                                    {handleEdit &&
                                        <>
                                            <IconButton size="small" variant="text" onClick={() => handleSelectItem(item)}>
                                                <LuTrash2
                                                    size={22} color="gray"
                                                />
                                            </IconButton>

                                            {(!item.blur?.visibility || item.blur?.visibility === VISIBILITY_PUBLIC || (item.blur?.visibility === VISIBILITY_PASSWORD && item.isDecrypt)) &&
                                                <IconButton size="small" variant="text" onClick={() => handleEdit(item)} >
                                                    <FiEdit
                                                        size={22} color="gray"
                                                    />
                                                </IconButton>
                                            }
                                            <IconButton size="small" variant="text" onClick={() => handleCopyToClipboard(item)} >
                                                <LuClipboardCheck
                                                    size={22} color="gray"
                                                />
                                            </IconButton>
                                        </>
                                    }

                                    {(!handleEdit && ((item.blur?.visibility !== VISIBILITY_PASSWORD) || (item.isDecrypt && item.blur?.visibility === VISIBILITY_PASSWORD))) &&

                                        <IconButton size="small" variant="text" onClick={() => handleDisplay(item)} >
                                            {item.isDetailDisplay ? (

                                                <IoMdEyeOff
                                                    size={22} color="gray"
                                                />
                                            ) : (
                                                <IoMdEye
                                                    size={22} color="gray"
                                                />
                                            )}
                                        </IconButton>
                                    }

                                    <IconButton size="small" variant="text"  >
                                        <a href={item.postURL} target="_blank" className="text-gray-500">
                                            <svg width="22" height="22" viewBox="0 0 1452 1452" xmlns="http://www.w3.org/2000/svg"><path d="M725.669,684.169c85.954,-174.908 196.522,-329.297 331.704,-463.171c45.917,-43.253 98.131,-74.732 156.638,-94.443c80.779,-23.002 127.157,10.154 139.131,99.467c-2.122,144.025 -12.566,287.365 -31.327,430.015c-29.111,113.446 -96.987,180.762 -203.629,201.947c-36.024,5.837 -72.266,8.516 -108.726,8.038c49.745,11.389 95.815,32.154 138.21,62.292c77.217,64.765 90.425,142.799 39.62,234.097c-37.567,57.717 -83.945,104.938 -139.131,141.664c-82.806,48.116 -154.983,33.716 -216.529,-43.202c-28.935,-38.951 -52.278,-81.818 -70.026,-128.603c-12.177,-34.148 -24.156,-68.309 -35.935,-102.481c-11.779,34.172 -23.757,68.333 -35.934,102.481c-17.748,46.785 -41.091,89.652 -70.027,128.603c-61.545,76.918 -133.722,91.318 -216.529,43.202c-55.186,-36.726 -101.564,-83.947 -139.131,-141.664c-50.804,-91.298 -37.597,-169.332 39.62,-234.097c42.396,-30.138 88.466,-50.903 138.21,-62.292c-36.46,0.478 -72.702,-2.201 -108.725,-8.038c-106.643,-21.185 -174.519,-88.501 -203.629,-201.947c-18.762,-142.65 -29.205,-285.99 -31.328,-430.015c11.975,-89.313 58.352,-122.469 139.132,-99.467c58.507,19.711 110.72,51.19 156.637,94.443c135.183,133.874 245.751,288.263 331.704,463.171Z" fill="currentColor" /></svg>
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
                        <Button color="secondary" size="large" className="text-white text-base font-normal" disabled={isLoading} onClick={() => getPosts(cursor)} >
                            {deleteList.length == 10 ? locale.DeleteList_ReadMore : locale.DeleteList_ToHead}
                        </Button>
                    </div>
                }

            </div >
        </>)
}