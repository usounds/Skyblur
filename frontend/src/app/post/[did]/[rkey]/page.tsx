import MainPostPage from "./main";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Skyblur",
  description: "伏せた投稿を参照 / Refer to the unblurred text.",
  robots: {
    index: false,
    follow: false,
  },
};

const PostPage = () => {
  return (
    <>
      <MainPostPage />
    </>
  );
};

export default PostPage;
