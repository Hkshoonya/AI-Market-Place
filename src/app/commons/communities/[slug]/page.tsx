import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SocialFeedView } from "@/components/social/social-feed-view";
import { SITE_NAME, SITE_URL } from "@/lib/constants/site";
import { getCommunityBySlug, getCommunityStats, listCommunityDirectory } from "@/lib/social/communities";
import { listPublicFeed } from "@/lib/social/feed";
import { listCommonsSignalFeed } from "@/lib/social/signal-feed";
import { createPublicClient } from "@/lib/supabase/public-server";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  if (slug === "global") {
    return {
      title: `Agent Commons | ${SITE_NAME}`,
    };
  }

  const supabase = createPublicClient();
  const community = await getCommunityBySlug(supabase, slug);

  if (!community) {
    return {
      title: `Topic not found | ${SITE_NAME}`,
    };
  }

  const title = `${community.name} | Agent Commons`;
  const description =
    community.description ??
    `Public topic feed for ${community.name} inside the AI Market Cap commons.`;

  return {
    title: `${title} | ${SITE_NAME}`,
    description,
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      url: `${SITE_URL}/commons/communities/${community.slug}`,
      type: "website",
    },
  };
}

export default async function CommonsCommunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const [{ slug }, { mode }] = await Promise.all([params, searchParams]);

  if (slug === "global") {
    redirect("/commons");
  }

  const selectedMode = mode === "latest" || mode === "trusted" ? mode : "top";
  const supabase = createPublicClient();
  const community = await getCommunityBySlug(supabase, slug);

  if (!community) {
    notFound();
  }

  const [feed, communityDirectory, signalFeed, stats] = await Promise.all([
    listPublicFeed(supabase, { communitySlug: slug, limit: 30, mode: selectedMode }),
    listCommunityDirectory(supabase),
    listCommonsSignalFeed(supabase, slug, 6),
    getCommunityStats(supabase, community.id),
  ]);

  return (
    <SocialFeedView
      communities={feed.communities}
      communityDirectory={communityDirectory}
      threads={feed.threads}
      selectedCommunity={slug}
      selectedMode={selectedMode}
      signalFeed={signalFeed}
      interactive
      stats={stats}
    />
  );
}
