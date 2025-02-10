import { useEffect, useState } from "react";
import { BiRepost } from "react-icons/bi";
import { BiHeart } from "react-icons/bi";
import { BiCommentCheck } from "react-icons/bi";
import { transformUrl } from "@/logic/HandleBluesky";

interface Props {
  atUriPost: string;
  atUriBlur: string;
}

const Reaction: React.FC<Props> = ({ atUriPost, atUriBlur }) => {
  const [repostCount, setRepostCount] = useState<number | null>(null);
  const [quoteCount, setQuoteCount] = useState<number | null>(null);
  const [likeCount, setLikeCount] = useState<number | null>(null);
  const [intent, setIntent] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(
          `https://links.bsky.bad-example.com/links/all?target=${encodeURIComponent(atUriPost)}`
        );
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        const data = await response.json();
        const count = data.links?.["app.bsky.feed.repost"]?.[".subject.uri"]?.records || 0;
        setRepostCount(count);
        setLikeCount(data.links?.["app.bsky.feed.like"]?.[".subject.uri"]?.records || 0)
        setQuoteCount(data.links?.["app.bsky.feed.post"]?.[".embed.record.uri"]?.records || 0)
        const response2 = await fetch(
          `https://links.bsky.bad-example.com/links/all?target=${transformUrl(atUriBlur)}`
        );
        if (!response2.ok) {
          throw new Error("Network response was not ok");
        }
        const data2 = await response2.json();
        const intent = data2.links?.["app.bsky.feed.post"]?.[".facets[].features[app.bsky.richtext.facet#link].uri"]?.records || 0
        setIntent(intent)
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, [atUriPost, atUriBlur]);

  return (
    <div className="flex items-center gap-6 mr-2 text-base text-gray-800">
      {intent !== null && intent > 0 && (
        <div className="flex items-center gap-0.5">
          <BiCommentCheck size={20} />
          <span>{intent}</span>
        </div>
      )}
      {repostCount !== null && quoteCount != null && repostCount + quoteCount > 0 && (
        <div className="flex items-center gap-0.5">
          <BiRepost size={24} />
          <span>{repostCount + quoteCount}</span>
        </div>
      )}
      {likeCount !== null && likeCount > 0 && (
        <div className="flex items-center gap-0.5">
          <BiHeart size={20} />
          <span>{likeCount}</span>
        </div>
      )}
    </div>
  );
};

export default Reaction;
