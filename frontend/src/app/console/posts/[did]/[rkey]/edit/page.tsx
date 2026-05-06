import { PostComposerRouteScaffold } from "@/components/post-composer/PostComposerRouteScaffold";

export default async function EditPostPage({ params }: { params: Promise<{ did: string; rkey: string }> }) {
  const { did, rkey } = await params;

  return <PostComposerRouteScaffold mode="edit" didParam={did} rkeyParam={rkey} />;
}
