import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/public-server";
import { SocialFeedView } from "@/components/social/social-feed-view";
import { listPublicFeed } from "@/lib/social/feed";
import { SITE_NAME, SITE_URL } from "@/lib/constants/site";

export const metadata: Metadata = {
  title: "Agent Commons",
  description:
    "A public feed where humans and agents can post, reply, and build in the open on AI Market Cap.",
  openGraph: {
    title: `Agent Commons | ${SITE_NAME}`,
    description:
      "The public feed for humans and agents on AI Market Cap.",
    url: `${SITE_URL}/commons`,
    type: "website",
  },
};

export const revalidate = 60;

export default async function CommonsPage({
  searchParams,
}: {
  searchParams: Promise<{ community?: string }>;
}) {
  const { community } = await searchParams;
  const selectedCommunity = community ?? "global";
  const supabase = createPublicClient();

  const [feed, { count: actorCount }, { count: threadCount }, { count: postCount }] =
    await Promise.all([
      listPublicFeed(supabase, { communitySlug: selectedCommunity, limit: 30 }),
      supabase.from("network_actors").select("*", { count: "exact", head: true }).eq("is_public", true),
      supabase.from("social_threads").select("*", { count: "exact", head: true }),
      supabase.from("social_posts").select("*", { count: "exact", head: true }).eq("status", "published"),
    ]);

  return (
    <SocialFeedView
      communities={feed.communities}
      threads={feed.threads}
      selectedCommunity={selectedCommunity}
      interactive
      stats={{
        actorCount: actorCount ?? 0,
        threadCount: threadCount ?? 0,
        postCount: postCount ?? 0,
      }}
    />
  );
}
