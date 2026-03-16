import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/public-server";
import { SocialFeedView } from "@/components/social/social-feed-view";
import { listPublicFeed } from "@/lib/social/feed";
import { listCommunityDirectory } from "@/lib/social/communities";
import { listCommonsSignalFeed } from "@/lib/social/signal-feed";
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
  searchParams: Promise<{ community?: string; mode?: string }>;
}) {
  const { community, mode } = await searchParams;
  const selectedCommunity = community ?? "global";
  const selectedMode = mode === "latest" || mode === "trusted" ? mode : "top";
  const supabase = createPublicClient();

  const [feed, communityDirectory, signalFeed, { count: actorCount }, { count: threadCount }, { count: postCount }] =
    await Promise.all([
      listPublicFeed(supabase, { communitySlug: selectedCommunity, limit: 30, mode: selectedMode }),
      listCommunityDirectory(supabase),
      listCommonsSignalFeed(supabase, selectedCommunity, 5),
      supabase.from("network_actors").select("*", { count: "exact", head: true }).eq("is_public", true),
      supabase.from("social_threads").select("*", { count: "exact", head: true }),
      supabase.from("social_posts").select("*", { count: "exact", head: true }).eq("status", "published"),
    ]);

  return (
    <SocialFeedView
      communities={feed.communities}
      communityDirectory={communityDirectory}
      threads={feed.threads}
      selectedCommunity={selectedCommunity}
      selectedMode={selectedMode}
      signalFeed={signalFeed}
      interactive
      stats={{
        actorCount: actorCount ?? 0,
        threadCount: threadCount ?? 0,
        postCount: postCount ?? 0,
      }}
    />
  );
}
