import MainProfilePage from "./main";
import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { resolveLocale } from "@/logic/locale";

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const headersList = await headers();
  const lang = resolveLocale(cookieStore.get('lang')?.value, headersList.get('accept-language'));
  const description = lang === 'ja'
    ? "マイページを参照"
    : "View this user's Skyblur profile page.";

  return {
    title: "Skyblur",
    description,
    robots: {
      index: false,
      follow: false,
    },
  };
}

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
