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

const PostPage = async ({ params }: { params: Promise<{ did: string }> }) => {
  const { did } = await params;
  const decodedDid = decodeURIComponent(did);

  return (
    <>
      <link rel="alternate" href={`at://${decodedDid}`} />
      <MainProfilePage />
    </>
  );
};

export default PostPage;
