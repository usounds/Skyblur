import { formatDateToLocale } from "@/logic/LocaledDatetime";
import { useXrpcAgentStore } from "@/state/XrpcAgent";
import { useLocaleStore } from "@/state/Locale";
import { PostView } from "@/types/types";
import { Button, Input, Timeline, Group } from '@mantine/core';
import { useEffect, useState } from "react";
import BeatLoader from "react-spinners/BeatLoader";
import { FaReply } from "react-icons/fa";

type ReplyListProps = {
    handleSetPost: (input: PostView) => void;
};

export const ReplyList: React.FC<ReplyListProps> = ({
    handleSetPost
}) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [currentCursor, setCursor] = useState("");
    const agent = useXrpcAgentStore((state) => state.agent);
    const LIMIT = 20
    const [postList, setPostList] = useState<PostView[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const locale = useLocaleStore((state) => state.localeData);


    const handleValueChange = (value: string) => {
        // 入力値をステートに設定
        setSearchTerm(value);
        setCursor('')
    };

    const getPosts = async () => {
        if (!agent) return
        setIsLoading(true)
        setPostList([])

        const result = await agent.get("app.bsky.feed.searchPosts", {
            params: {
                q: "from:me " + searchTerm,
                limit: LIMIT,
                cursor: ''
            }
        });

        if (!result.ok) return

        setCursor(result.data.cursor || "")

        setPostList(result.data.posts as PostView[])
        setIsLoading(false)
    }


    const addPostsToPostList = (newPosts: PostView[]) => {
        // postListにnewPostsを追加した新しい配列をセット
        setPostList([...postList, ...newPosts]);
    }

    const getNext = async () => {
        if (!agent) return
        setIsLoading(true)

        const result = await agent.get("app.bsky.feed.searchPosts", {
            params: {
                q: "from:me " + searchTerm,
                limit: LIMIT,
                cursor: currentCursor
            }
        });

        if (!result.ok) return

        setCursor(result.data.cursor || "")

        addPostsToPostList(result.data.posts as PostView[])
        setIsLoading(false)

    }

    const setPost = (newPosts: PostView) => {
        // postListにnewPostsを追加した新しい配列をセット
        handleSetPost(newPosts)
    }


    useEffect(() => {
        getPosts()


        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (

        <>
            <Group gap="sm" align="center" justify="center" m="sm">
                <Input
                    value={searchTerm}
                    onChange={(event) => handleValueChange(event.target.value)}
                    styles={{
                        input: {
                            fontSize: 16,  // 16pxに設定
                        },
                    }} />
                <Button
                    onClick={getPosts}
                >
                    {locale.ReplyList_Search}
                </Button>
            </Group>


            {postList.length === 0 &&

                <div className="flex flex-col items-center justify-center h-full">
                    {isLoading && (
                        <div className="flex justify-center items-center">
                            <BeatLoader />
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

                            <span className="">
                                {item.record.reply && locale.ReplyList_ReplyDescrition}
                                {item.record.text}
                            </span>
                            <span className="flex justify-center">
                                <Button
                                    onClick={() => setPost(item)}
                                    variant="outline"
                                    color="gray"
                                    leftSection={<FaReply />}
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
                    <Button variant="filled" color="gray" onClick={getNext}>
                        {locale.DeleteList_ReadMore}
                    </Button>
                </div>
            }

            {(isLoading && postList.length !== 0) &&

                <div className="flex flex-col items-center justify-center h-full text-gray-700">
                    {isLoading && (
                        <div className="flex justify-center items-center">
                            <BeatLoader />
                        </div>
                    )}

                </div>
            }


        </>
    )
}