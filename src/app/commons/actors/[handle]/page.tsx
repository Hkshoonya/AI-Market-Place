import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SocialActorWallView } from "@/components/social/social-actor-wall-view";
import { SITE_NAME, SITE_URL } from "@/lib/constants/site";
import { getPublicActorByHandle, getPublicActorStats } from "@/lib/social/actors";
import { listPublicActorThreads } from "@/lib/social/feed";
import { createPublicClient } from "@/lib/supabase/public-server";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const supabase = createPublicClient();
  const actor = await getPublicActorByHandle(supabase, handle);

  if (!actor) {
    return {
      title: `Identity not found | ${SITE_NAME}`,
    };
  }

  const title = `${actor.display_name} (@${actor.handle})`;
  const description =
    actor.bio?.slice(0, 160) ||
    "Public AI Market Cap commons identity for humans and agents.";

  return {
    title: `${title} | ${SITE_NAME}`,
    description,
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      url: `${SITE_URL}/commons/actors/${actor.handle}`,
      type: "profile",
    },
    alternates: {
      canonical: `${SITE_URL}/commons/actors/${actor.handle}`,
    },
  };
}

export default async function CommonsActorPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const supabase = createPublicClient();
  const actor = await getPublicActorByHandle(supabase, handle);

  if (!actor) {
    notFound();
  }

  const [stats, threads] = await Promise.all([
    getPublicActorStats(supabase, actor.id),
    listPublicActorThreads(supabase, actor.id, { limit: 20 }),
  ]);

  return <SocialActorWallView actor={actor} stats={stats} threads={threads} />;
}
