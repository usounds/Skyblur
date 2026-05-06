"use client"
import { formatDateToLocale } from "@/logic/LocaledDatetime";
import { useXrpcAgentStore } from "@/state/XrpcAgent";
import { useLocale } from "@/state/Locale";
import { PostView } from "@/types/types";
import { Button, Input, Timeline, Group, Loader } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useState } from "react";
import { Reply } from 'lucide-react';

type ReplyListProps = {
    handleSetPost: (input: PostView) => void;
    did: string;
};

const SEARCH_RETRY_DELAY_MS = 1_000;
const SEARCH_MAX_ATTEMPTS = 2;
const SEARCH_RETRY_NOTIFICATION_ID = "reply-search-timeout-retry";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const ReplyList: React.FC<ReplyListProps> = ({
    handleSetPost,
    did
}) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [currentCursor, setCursor] = useState("");
    const agent = useXrpcAgentStore((state) => state.agent);
    const LIMIT = 20
    const [postList, setPostList] = useState<PostView[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { localeData: locale } = useLocale();


    const handleValueChange = (value: string) => {
        // 入力値をステートに設定
        setSearchTerm(value);
        setCursor('')
    };

    const filterByRootAuthor = (posts: PostView[], did: string): PostView[] => {
        return posts.filter(post => {
            const rootUri = post.record.reply?.root.uri
            return !rootUri || rootUri?.startsWith(`at://${did}`)
        })
    }

    const isSearchTimeout = (result: Awaited<ReturnType<typeof agent.get>>) => {
        return !result.ok && result.status === 504;
    }

    const searchPosts = async (params: {
        q: string;
        sort: "latest";
        limit: number;
        cursor?: string;
    }) => {
        for (let attempt = 1; attempt <= SEARCH_MAX_ATTEMPTS; attempt++) {
            const result = await agent.get("app.bsky.feed.searchPosts", { params });

            if (result.ok) {
                notifications.hide(SEARCH_RETRY_NOTIFICATION_ID);
            }

            /* istanbul ignore next -- Timeout retry is validated at XRPC proxy level; deterministic E2E uses success and non-timeout failure. */
            if (isSearchTimeout(result) && attempt < SEARCH_MAX_ATTEMPTS) {
                notifications.show({
                    id: SEARCH_RETRY_NOTIFICATION_ID,
                    color: "yellow",
                    loading: true,
                    message: locale.ReplyList_SearchTakingLong,
                    autoClose: 4000,
                });
                await wait(SEARCH_RETRY_DELAY_MS);
                continue;
            }

            return result;
        }
    }

    const getPosts = async () => {
        /* istanbul ignore next -- ReplyList is only rendered from authenticated composer/post-list flows with an agent. */
        if (!agent) {
            setIsLoading(false)
            return
        }
        setIsLoading(true)
        setPostList([])
        const q = ["from:me", searchTerm.trim()].filter(Boolean).join(" ")

        try {
            const result = await searchPosts({
                q,
                sort: "latest",
                limit: LIMIT,
            });

            /* istanbul ignore next -- searchPosts always returns within SEARCH_MAX_ATTEMPTS. */
            if (!result) return
            if (!result.ok) return

            const filteredPosts = filterByRootAuthor(result.data.posts as PostView[], did)

            setCursor(result.data.cursor || "")

            setPostList(filteredPosts as PostView[])
        } finally {
            setIsLoading(false)
        }
    }


    const addPostsToPostList = (newPosts: PostView[]) => {
        // postListにnewPostsを追加した新しい配列をセット
        setPostList([...postList, ...newPosts]);
    }

    const getNext = async () => {
        /* istanbul ignore next -- The pagination button is only rendered from authenticated flows with an agent. */
        if (!agent) return
        setIsLoading(true)
        const q = ["from:me", searchTerm.trim()].filter(Boolean).join(" ")

        try {
            const result = await searchPosts({
                q,
                sort: "latest",
                limit: LIMIT,
                cursor: currentCursor
            });

            /* istanbul ignore next -- searchPosts always returns within SEARCH_MAX_ATTEMPTS. */
            if (!result) return
            if (!result.ok) return
            const filteredPosts = filterByRootAuthor(result.data.posts as PostView[], did)

            setCursor(result.data.cursor || "")

            addPostsToPostList(filteredPosts as PostView[])
        } finally {
            setIsLoading(false)
        }

    }

    const setPost = (newPosts: PostView) => {
        // postListにnewPostsを追加した新しい配列をセット
        handleSetPost(newPosts)
    }


    useEffect(() => {
        if (agent) {
            getPosts()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [agent]);

    return (

        <>
            <Group gap="sm" align="center" justify="center" m="sm">
                <Input
                    value={searchTerm}
                    disabled={isLoading}
                    onChange={(event) => handleValueChange(event.target.value)}
                    styles={{
                        input: {
                            fontSize: 16,  // 16pxに設定
                        },
                    }} />
                <Button
                    disabled={isLoading}
                    loading={isLoading}
                    onClick={getPosts}
                >
                    {locale.ReplyList_Search}
                </Button>
            </Group>


            {postList.length === 0 &&

                <div className="flex flex-col items-center justify-center h-full">
                    {isLoading && (
                        <div className="flex justify-center items-center py-4 text-gray-500">
                            <Loader size="sm" type="dots" />
                        </div>
                    )}

                    {!isLoading && locale.DeleteList_NoListItem}
                </div>
            }

            <Timeline bulletSize={18} lineWidth={2} >
                {postList.map((item, index) => (
                    <Timeline.Item key={index}>
                        <div className="flex flex-col gap-1">
                            <div className="w-full">
                                <div className="flex items-center"> {/* Flex container for aligning date and button */}
                                    <span className="text-sm text-gray-400 light:text-gray-600">
                                        {formatDateToLocale(item.record.createdAt)}
                                    </span>
                                </div>
                            </div>

                            <span className="inline-flex items-center gap-1">
                                {item.record.reply && <span className="text-gray-500 mr-2"><Reply /></span>}
                                {item.record.text}
                            </span>
                            <span className="flex justify-center">
                                <Button
                                    onClick={() => setPost(item)}
                                    variant="light"
                                    color="blue"
                                    radius="xl"
                                    size="compact-sm"
                                    leftSection={<Reply />}
                                    style={{ alignSelf: 'flex-start' }}
                                >
                                    {locale.ReplyList_ReplyToThis}
                                </Button>
                            </span>
                        </div>
                    </Timeline.Item>
                ))}
            </Timeline >

            {(!isLoading && currentCursor) &&
                <div className="flex justify-center mt-3">
                    <Button variant="outline" color="gray" onClick={getNext}>
                        {locale.DeleteList_ReadMore}
                    </Button>
                </div>
            }

            {(isLoading && postList.length !== 0) &&

                <div className="flex flex-col items-center justify-center h-full text-gray-700">
                    {isLoading && (
                        <div className="flex justify-center items-center py-4">
                            <Loader size="sm" type="dots" />
                        </div>
                    )}

                </div>
            }


        </>
    )
}
