import MainPostPage from "./main";
import type { Metadata } from "next";

import { Client, simpleFetchHandler } from "@atcute/client";

export async function generateMetadata({ params }: { params: Promise<{ did: string; rkey: string }> }) {
  const { did } = await params;
  const decodedDid = decodeURIComponent(did);

  let description = "伏せた投稿を参照 / Refer to the unblurred text.";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const apiAgent = new Client({
      handler: simpleFetchHandler({
        service: 'https://public.api.bsky.app',
        fetch: (input, init) => fetch(input, { ...init, signal: controller.signal }),
      }),
    });

    try {
      const response = await apiAgent.get('app.bsky.actor.getProfile', {
        params: { actor: decodedDid as any },
      });

      if (response.ok) {
        const handle = response.data.handle;
        description = `@${handle}さんの伏せた投稿を参照する`;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn("Failed to fetch profile for metadata: Timed out");
    } else {
      console.warn("Failed to fetch profile for metadata:", error);
    }
  }

  return {
    title: "Skyblur",
    description: description,
    openGraph: {
      title: "Skyblur",
      description: description,
    },
    twitter: {
      card: 'summary_large_image',
      title: "Skyblur",
      description: description,
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}

const PostPage = async ({ params }: { params: Promise<{ did: string; rkey: string }> }) => {
  const { did, rkey } = await params;
  const decodedDid = decodeURIComponent(did);

  return (
    <>
      <link rel="alternate" href={`at://${decodedDid}/app.bsky.feed.post/${rkey}`} />
      <MainPostPage />
    </>
  );
};

export default PostPage;
