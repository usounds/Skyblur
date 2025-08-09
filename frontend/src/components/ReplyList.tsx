import { formatDateToLocale } from "@/logic/LocaledDatetime";
//import { useAtpAgentStore } from "@/state/AtpAgent";
import { useXrpcAgentStore } from "@/state/XrpcAgent";
import { useLocaleStore } from "@/state/Locale";
import { PostView } from "@/types/types";
import { Button, Input, Step, Stepper } from 'reablocks';
import { useEffect, useState } from "react";
import BeatLoader from "react-spinners/BeatLoader";

type ReplyListProps = {
    handleSetPost: (input: PostView) => void;
};

export const ReplyList: React.FC<ReplyListProps> = ({
    handleSetPost
}) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [currentCursor, setCursor] = useState("");
    const agent = useXrpcAgentStore((state) => state.agent);
    const LIMIT = 10
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
            <div className="flex flex-row items-center justify-center m-2"> {/* Flexbox with centered alignment */}
                <Input value={searchTerm} size="medium" onValueChange={handleValueChange} />
                <Button
                    color="primary"
                    size="medium"
                    className="text-white mx-2 font-normal"
                    onClick={getPosts}
                >
                    {locale.ReplyList_Search}
                </Button>
            </div>


            {postList.length === 0 &&

                <div className="flex flex-col items-center justify-center h-full text-gray-700">
                    {isLoading && (
                        <div className="flex justify-center items-center">
                            <BeatLoader />
                        </div>
                    )}

                    {!isLoading && locale.DeleteList_NoListItem}
                </div>
            }

            <Stepper animated className="bg-white mt-2">

                {postList.map((item, index) => (
                    <Step key={index}>
                        <div className="flex flex-col gap-1">
                            <div className="w-full">
                                <div className="flex items-center"> {/* Flex container for aligning date and button */}
                                    <span className="text-sm text-gray-400 light:text-gray-600">
                                        {formatDateToLocale(item.record.createdAt)}
                                    </span>
                                </div>
                            </div>

                            <span className="text-gray-600">
                                {item.record.reply && locale.ReplyList_ReplyDescrition}
                                {item.record.text}
                            </span>
                            <Button
                                size="small"
                                onClick={() => setPost(item)}
                                variant="outline"
                                className="ml-4 text-gray-700 border-gray-400 font-normal"
                            >
                                {locale.ReplyList_ReplyToThis}
                            </Button>
                        </div>
                    </Step>
                ))}
            </Stepper >

            {(!isLoading && currentCursor) &&
                <div className="flex justify-center">
                    <Button color="primary" size="medium" className="text-white mx-2 font-normal" onClick={getNext}>
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