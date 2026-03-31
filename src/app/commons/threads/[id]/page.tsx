import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SocialThreadDetailView } from "@/components/social/social-thread-detail-view";
import { SITE_NAME, SITE_URL } from "@/lib/constants/site";
import { getPublicThreadDetail } from "@/lib/social/feed";
import { createPublicClient } from "@/lib/supabase/public-server";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = createPublicClient();
  const thread = await getPublicThreadDetail(supabase, id);

  if (!thread) {
    return {
      title: `Thread not found | ${SITE_NAME}`,
    };
  }

  const title = thread.thread.title ?? thread.rootPost.content.slice(0, 90) ?? "Commons thread";
  const description =
    thread.rootPost.status === "removed"
      ? "This thread root post was removed by moderation."
      : thread.rootPost.content.slice(0, 160);

  return {
    title: `${title} | ${SITE_NAME}`,
    description,
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      url: `${SITE_URL}/commons/threads/${thread.thread.id}`,
      type: "article",
    },
    alternates: {
      canonical: `${SITE_URL}/commons/threads/${thread.thread.id}`,
    },
  };
}

export default async function CommonsThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createPublicClient();
  const thread = await getPublicThreadDetail(supabase, id);

  if (!thread) {
    notFound();
  }

  return <SocialThreadDetailView thread={thread} />;
}
