import MainProfilePage from "./main";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Skyblur",
  description: "マイページを参照 / Refer to this user's my page.",
  robots: {
    index: false,
    follow: false,
  },
};

const PostPage = () => {
  return (
    <>
      <MainProfilePage />
    </>
  );
};

export default PostPage;
