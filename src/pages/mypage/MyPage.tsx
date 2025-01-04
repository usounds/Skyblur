import DeleteModal from "@/component/DeleteModal";
import Modal from "@/component/Modal";
import PostTextWithBold from "@/component/PostTextWithBold";
import { fetchSession, transformUrl } from "@/logic/HandleBluesky";
import { formatDateToLocale } from "@/logic/LocaledDatetime";
import { useLocaleStore } from "@/state/Locale";
import { State, useXrpcStore } from '@/state/Xrpc';
import { COLLECTION, PostData, PostListItem } from "@/type/types";
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ExpandCircleDownIcon from '@mui/icons-material/ExpandCircleDown';
import PreviewIcon from '@mui/icons-material/Preview';
import LoadingButton from '@mui/lab/LoadingButton';
import Timeline from '@mui/lab/Timeline';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineDot from '@mui/lab/TimelineDot';
import TimelineItem, { timelineItemClasses } from '@mui/lab/TimelineItem';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import CircularProgress from '@mui/material/CircularProgress';
import CssBaseline from '@mui/material/CssBaseline';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from "react";
import { Link as InnerLink, useNavigate } from 'react-router-dom';
import AppTheme from '../shared-theme/AppTheme';

const MyPage = () => {
    const did = useXrpcStore((state) => state.did);
    const pageNationLimit = 10;
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const loginXrpc = useXrpcStore((state) => state.loginXrpc);
    const [cursor, setCursor] = useState("");
    const locale = useLocaleStore((state) => state.localeData);
    const [selectedItem, setSelectedItem] = useState<PostListItem | null>(null);
    const [postList, setPostList] = useState<PostListItem[]>([]);
    const [message, setMessage] = useState('')
    const [isModal, setIsModal] = useState(false)
    const [isLoadMore, setIsLoadMore] = useState(false)
    const isLoginProcess = useXrpcStore((state) => state.isLoginProcess);

    const getPosts = async (cursor: string, loginXrpc: State['loginXrpc']) => {

        if (!loginXrpc) {
            console.error("未ログインです")
            navigate('/login');
            return
        }

        setIsLoading(true)
        try {
            const param = {
                repo: did,
                collection: COLLECTION,
                cursor: cursor,
                limit: pageNationLimit
            };

            const ret = await loginXrpc.get("com.atproto.repo.listRecords", { params: param })

            // 新しいカーソルを設定
            if (ret.data.records.length === pageNationLimit) {
                setCursor(ret.data.cursor || '');
            } else {
                setCursor('');

            }

            const sortedRecords = ret.data.records.sort((a, b) => {
                const dateA = new Date((a.value as PostData).createdAt).getTime();
                const dateB = new Date((b.value as PostData).createdAt).getTime();
                return dateB - dateA;
            });

            for (const obj of sortedRecords) {
                const value = obj.value as PostData;

                // すでに同一の blurATUri が postList に存在するかチェック
                const existingPost = postList.some(post => post.blurATUri === obj.uri);

                if (!existingPost) {
                    postList.push({
                        blurATUri: obj.uri,
                        blur: value,
                        postURL: transformUrl(value.uri),
                        blurURL: transformUrl(obj.uri),
                        modal: false
                    });
                }
            }

            setPostList(postList)
            setIsLoading(false);

        } catch (error) {
            console.error('Error fetching bookmarks:', error);
        }
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
        if (!loginXrpc) {
            console.error("未ログインです")
            return
        }

        const param = convertAtUrlToObject(aturi)

        await loginXrpc.call("com.atproto.repo.deleteRecord", { data: param })

    }

    const handleClose = () => {
        setSelectedItem(null)

    }

    const handleDeleteItem = async () => {
        console.log('handleDeleteItem')
        try {
            // 非同期操作を待つ
            await deleteRecord(selectedItem?.blur.uri || '')
            await deleteRecord(selectedItem?.blurATUri || '')
            if (selectedItem) setPostList(prevList => prevList.filter(item => item.blurATUri !== selectedItem.blurATUri));
        } catch (e) {
            // エラーハンドリング
            console.error("エラーが発生しました:", e);
            //notifyError('Error:' + e)
            return
        }
        // 実際の削除処理をここに追加
        //notifySuccess(locale.DeleteList_Complete)
        console.log("削除されました:", selectedItem);

    };

    const handleDeleteItemClicked = (item: PostListItem) => {
        console.log('handleDeleteItemClicked')
        setSelectedItem(item)
    }



    const handleCopyClicked = async (item: PostListItem) => {
        await navigator.clipboard.writeText(item.blurURL || '')
        setMessage('コピーしました')
        setIsModal(true)


    }
    const handleModalClose = () => {
        setIsModal(false);

        // アニメーション終了後にメッセージをクリア
        setTimeout(() => {
        }, 300); // Snackbarのアニメーション時間に合わせる
    };


    const handleLoadMore = () => {
        setIsLoadMore(true)

        getPosts(cursor, loginXrpc)


        setIsLoadMore(false)
    };

    useEffect(() => {

        console.log('useEffect')

        // 非同期関数をuseEffect内に定義
        const fetchData = async () => {
            console.log('pattern1')
            console.log(isLoginProcess)
            console.log(loginXrpc)

            if (!isLoginProcess && !loginXrpc) {
                const ret = await fetchSession(loginXrpc, did, setMessage, useXrpcStore.getState().setIsLoginProcess, useXrpcStore.getState().setLoginXrpc, useXrpcStore.getState().setUserProf)

                if (!ret) {
                    navigate('/login');
                    return
                } else {
                    getPosts(cursor, ret)

                }

            } else if (loginXrpc) {
                console.log('pattern2')
                getPosts(cursor, loginXrpc)

            }

        };

        // 非同期関数を即座に呼び出し
        fetchData();
    }, [loginXrpc, isLoginProcess]); // 空の依存配列を使用して、コンポーネントのマウント時にのみ実行

    return (
        <AppTheme >
            <CssBaseline enableColorScheme />
            <Modal message={message} onClose={handleModalClose} open={isModal} />
            <Stack
                component="main"
                direction="column"
                sx={[
                    {
                        justifyContent: 'center',  // Vertical centering
                        alignItems: 'center',      // Horizontal centering
                        minHeight: '100%',
                        height: 'calc((1 - var(--template-frame-height, 0)) * 100%)',
                        position: 'relative',      // for absolute positioning of pseudo-element
                        '&::before': {
                            content: '""',
                            display: 'block',
                            position: 'absolute',
                            zIndex: -1,
                            inset: 0,
                        },
                    }
                ]}
            >

                {!isLoginProcess &&
                    <>
                        <Stack
                            sx={{
                                marginY: 2, // This will add vertical margin to the element
                            }}
                        >
                            <InnerLink to="/create">
                                <Button
                                    color="secondary"
                                    variant='contained'
                                    startIcon={<AddIcon />}>
                                    {locale.Menu_CreatePost}
                                </Button>
                            </InnerLink>
                        </Stack>

                        <Typography sx={{ mt: 2, mb: 2 }} variant="h6" component="div">
                            {locale.DeleteList_ChooseDeleteItem}
                        </Typography>
                        <Stack
                            sx={{
                                minWidth: '0',
                                maxWidth: '720px',
                                width: {
                                    xs: '100%',
                                    sm: '620px',
                                    md: '720px',
                                },
                            }}
                        >
                            <Timeline
                                sx={{
                                    [`& .${timelineItemClasses.root}:before`]: {
                                        flex: 0,
                                        padding: 0,
                                    },
                                }}
                            >
                                {postList && postList.map((item, index) => (

                                    <TimelineItem key={index}>
                                        <TimelineSeparator>
                                            <TimelineDot />
                                            <TimelineConnector />
                                        </TimelineSeparator>
                                        <TimelineContent>
                                            <Typography variant="caption" >
                                                {formatDateToLocale(item.blur.createdAt)}
                                            </Typography>
                                            <div style={{ marginBottom: '6px', marginTop: '4px' }}>
                                                <PostTextWithBold postText={item.blur.text} isValidateBrackets={true} />
                                            </div>
                                            <ButtonGroup
                                                variant="outlined"
                                                aria-label="Basic button group"
                                                size="small"

                                                sx={{ display: 'flex', justifyContent: 'flex-end' }} // 右寄せ
                                            >
                                                <Tooltip title={locale.DeleteList_DeleteButton}>
                                                    <Button onClick={() => handleDeleteItemClicked(item)}><DeleteIcon /></Button>
                                                </Tooltip>
                                                <Tooltip title={locale.CreatePost_UpdateButton}>
                                                    <Button><EditIcon /></Button>
                                                </Tooltip>
                                                <Tooltip title="URLコピー">
                                                    <Button onClick={() => handleCopyClicked(item)}><ContentCopyIcon /></Button>
                                                </Tooltip>
                                                <Tooltip title="Skyblurで確認">
                                                    <Button><PreviewIcon /></Button>
                                                </Tooltip>
                                                <Tooltip title="Blueskyで確認">
                                                    <Link
                                                        href={item.postURL}
                                                        variant="body2"
                                                        target="_blank"
                                                        sx={{ textDecoration: 'none' }}
                                                    >
                                                        <Button>
                                                            <svg
                                                                className="h-5 w-5"
                                                                width="20"
                                                                height="20"
                                                                viewBox="0 0 1452 1452"
                                                                xmlns="http://www.w3.org/2000/svg"
                                                            >
                                                                <path
                                                                    d="M725.669,684.169c85.954,-174.908 196.522,-329.297 331.704,-463.171c45.917,-43.253 98.131,-74.732 156.638,-94.443c80.779,-23.002 127.157,10.154 139.131,99.467c-2.122,144.025 -12.566,287.365 -31.327,430.015c-29.111,113.446 -96.987,180.762 -203.629,201.947c-36.024,5.837 -72.266,8.516 -108.726,8.038c49.745,11.389 95.815,32.154 138.21,62.292c77.217,64.765 90.425,142.799 39.62,234.097c-37.567,57.717 -83.945,104.938 -139.131,141.664c-82.806,48.116 -154.983,33.716 -216.529,-43.202c-28.935,-38.951 -52.278,-81.818 -70.026,-128.603c-12.177,-34.148 -24.156,-68.309 -35.935,-102.481c-11.779,34.172 -23.757,68.333 -35.934,102.481c-17.748,46.785 -41.091,89.652 -70.027,128.603c-61.545,76.918 -133.722,91.318 -216.529,43.202c-55.186,-36.726 -101.564,-83.947 -139.131,-141.664c-50.804,-91.298 -37.597,-169.332 39.62,-234.097c42.396,-30.138 88.466,-50.903 138.21,-62.292c-36.46,0.478 -72.702,-2.201 -108.725,-8.038c-106.643,-21.185 -174.519,-88.501 -203.629,-201.947c-18.762,-142.65 -29.205,-285.99 -31.328,-430.015c11.975,-89.313 58.352,-122.469 139.132,-99.467c58.507,19.711 110.72,51.19 156.637,94.443c135.183,133.874 245.751,288.263 331.704,463.171Z"
                                                                    fill="currentColor"
                                                                />
                                                            </svg>
                                                        </Button>
                                                    </Link>
                                                </Tooltip>
                                            </ButtonGroup>

                                        </TimelineContent>
                                    </TimelineItem>

                                ))}

                                {(!cursor &&  postList.length>0 )&&
                                    <TimelineItem>
                                        <TimelineSeparator>
                                            <TimelineDot />
                                        </TimelineSeparator>
                                        <TimelineContent>
                                            {locale.DeleteList_NoListItem}
                                        </TimelineContent>
                                    </TimelineItem>
                                }
                                {(cursor && postList.length>0) && (
                                    <>
                                    <LoadingButton
                                        variant="contained"
                                        loading={isLoadMore}
                                        disabled={isLoadMore}
                                        loadingPosition="start"
                                        onClick={handleLoadMore}
                                        startIcon={<ExpandCircleDownIcon />}
                                        sx={{
                                            display: 'flex',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            width: { xs: '100%', sm: 'fit-content' },
                                            mx: 'auto', // 中央揃え（外側のマージンで調整）
                                        }}
                                    >
                                            {locale.DeleteList_ReadMore}
                                    </LoadingButton>
                                    </>
                                )}

                            </Timeline>
                        </Stack>


                        {selectedItem &&
                            <DeleteModal content={selectedItem.blur.text} onConfirm={handleDeleteItem} onClose={handleClose} title={locale.DeleteList_ConfirmDelete} execLabel={locale.DeleteList_DeleteButton}/>
                        }

                        {(!isLoading && postList?.length === 0) && <p className="text-m text-gray-800">{locale.DeleteList_NoListItem}</p>}

                        {isLoading ?

                            <CircularProgress color="inherit" />
                            :
                            <>

                            </>

                        }
                    </>
                }


                {isLoginProcess &&
                    <CircularProgress color="inherit" />
                }
            </Stack>
        </AppTheme >
    );
}

export default MyPage;