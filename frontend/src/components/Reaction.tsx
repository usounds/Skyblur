import { transformUrl } from "@/logic/HandleBluesky";
import { useLocaleStore } from "@/state/Locale";
import { useViewerStore } from "@/state/Viewer";
import { useEffect, useState } from "react";
import { BiCommentCheck, BiHeart, BiRepost } from "react-icons/bi";
import BeatLoader from "react-spinners/BeatLoader";

interface Props {
  atUriPost: string;
  atUriBlur: string;
}

const Reaction: React.FC<Props> = ({ atUriPost, atUriBlur }) => {
  const [repostCount, setRepostCount] = useState<number | null>(null);
  const [quoteCount, setQuoteCount] = useState<number | null>(null);
  const [likeCount, setLikeCount] = useState<number | null>(null);
  const [intent, setIntent] = useState<number | null>(null);
  const isHideReactions = useViewerStore((state) => state.isHideReactions);
  const setIsHideReactions = useViewerStore((state) => state.setIsHideReactions);
  const locale = useLocaleStore((state) => state.localeData);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {

        const intentResult = await fetch(
          `https://constellation.microcosm.blue/links?target=${transformUrl(atUriBlur)}&collection=app.bsky.feed.post&path=.facets%5B%5D.features%5Bapp.bsky.richtext.facet%23link%5D.uri`
        );

        if (!intentResult.ok) {
          throw new Error("Network response was not ok");
        }
        const intentResultJson = await intentResult.json();
        const intent = intentResultJson.total || 0

        let response

        try {
          response = await fetch(
            `https://constellation.microcosm.blue/links/all?target=${encodeURIComponent(atUriPost)}`
          );
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
        } catch (e) {
          console.error(e)
          throw new Error("Network response was not ok");

        }
        const data = await response.json();
        const count = data.links?.["app.bsky.feed.repost"]?.[".subject.uri"]?.records || 0;
        setRepostCount(count);
        setLikeCount(data.links?.["app.bsky.feed.like"]?.[".subject.uri"]?.records || 0)
        setQuoteCount(data.links?.["app.bsky.feed.post"]?.[".embed.record.uri"]?.records || 0)
        setIntent(intent)


      } catch (error) {
        console.error("Error fetching data:", error);
      }

      setIsLoading(false);
    };

    fetchData();
  }, [atUriPost, atUriBlur]);

  return (
    <div className="flex items-center gap-4 text-sm text-gray-600" onClick={() => setIsHideReactions(!isHideReactions)}>

      {isLoading ? (
        <BeatLoader size={12} color="#4B5563" />
      ) : isHideReactions ? (
        locale.Post_ViewReactions
      ) : (
        <>
          {intent !== null && intent > 0 && (
            <div className="flex items-center gap-0.5">
              <BiCommentCheck size={18} />
              <span>{intent}</span>
            </div>
          )}
          {repostCount !== null && quoteCount !== null && repostCount + quoteCount > 0 && (
            <div className="flex items-center gap-0.5">
              <BiRepost size={20} />
              <span>{repostCount + quoteCount}</span>
            </div>
          )}
          {likeCount !== null && likeCount > 0 && (
            <div className="flex items-center gap-0.5">
              <BiHeart size={20} />
              <span>{likeCount}</span>
            </div>
          )}
        </>
      )}

    </div>
  );
};

export default Reaction;
