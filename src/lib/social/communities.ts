import type { TypedSupabaseClient } from "@/types/database";
import type {
  SocialCommunityRow,
  SocialPostRow,
  SocialThreadRow,
} from "@/lib/schemas/social";

export interface CommunityDirectoryItem extends SocialCommunityRow {
  threadCount: number;
  postCount: number;
  lastPostedAt: string | null;
}

interface BuildCommunityDirectoryInput {
  communities: SocialCommunityRow[];
  threads: Pick<SocialThreadRow, "community_id" | "last_posted_at">[];
  posts: Pick<SocialPostRow, "community_id" | "status">[];
}

export function buildCommunityFeedHref(
  slug: string,
  mode: "top" | "latest" | "trusted" = "top"
) {
  const params = new URLSearchParams();
  if (mode !== "top") {
    params.set("mode", mode);
  }

  if (slug === "global") {
    const query = params.toString();
    return query ? `/commons?${query}` : "/commons";
  }

  const query = params.toString();
  return query ? `/commons/communities/${slug}?${query}` : `/commons/communities/${slug}`;
}

function byNewest(first: string | null, second: string | null) {
  if (!first && !second) return 0;
  if (!first) return 1;
  if (!second) return -1;

  return new Date(second).getTime() - new Date(first).getTime();
}

export function buildCommunityDirectory(
  input: BuildCommunityDirectoryInput
): CommunityDirectoryItem[] {
  const globalCommunity =
    input.communities.find((community) => community.is_global) ?? null;

  const items: CommunityDirectoryItem[] = input.communities.map((community) => ({
    ...community,
    threadCount: 0,
    postCount: 0,
    lastPostedAt: null,
  }));

  const itemMap = new Map(items.map((item) => [item.id, item]));

  for (const thread of input.threads) {
    const communityId = thread.community_id ?? globalCommunity?.id ?? null;
    if (!communityId) continue;

    const item = itemMap.get(communityId);
    if (!item) continue;

    item.threadCount += 1;
    if (
      !item.lastPostedAt ||
      new Date(thread.last_posted_at).getTime() >
        new Date(item.lastPostedAt).getTime()
    ) {
      item.lastPostedAt = thread.last_posted_at;
    }
  }

  for (const post of input.posts) {
    if (post.status !== "published") continue;

    const communityId = post.community_id ?? globalCommunity?.id ?? null;
    if (!communityId) continue;

    const item = itemMap.get(communityId);
    if (!item) continue;

    item.postCount += 1;
  }

  return items.sort((left, right) => {
    if (left.is_global !== right.is_global) {
      return left.is_global ? -1 : 1;
    }

    if (right.threadCount !== left.threadCount) {
      return right.threadCount - left.threadCount;
    }

    if (right.postCount !== left.postCount) {
      return right.postCount - left.postCount;
    }

    const recencyDifference = byNewest(left.lastPostedAt, right.lastPostedAt);
    if (recencyDifference !== 0) {
      return recencyDifference;
    }

    return left.name.localeCompare(right.name);
  });
}

export async function listCommunityDirectory(
  supabase: TypedSupabaseClient
): Promise<CommunityDirectoryItem[]> {
  const [{ data: communities, error: communityError }, { data: threads, error: threadError }, { data: posts, error: postError }] =
    await Promise.all([
      supabase
        .from("social_communities")
        .select("*")
        .order("is_global", { ascending: false })
        .order("name", { ascending: true }),
      supabase.from("social_threads").select("community_id, last_posted_at"),
      supabase.from("social_posts").select("community_id, status"),
    ]);

  if (communityError) {
    throw new Error(`Failed to load social communities: ${communityError.message}`);
  }

  if (threadError) {
    throw new Error(`Failed to load social threads: ${threadError.message}`);
  }

  if (postError) {
    throw new Error(`Failed to load social posts: ${postError.message}`);
  }

  return buildCommunityDirectory({
    communities: (communities ?? []) as SocialCommunityRow[],
    threads: (threads ?? []) as Pick<SocialThreadRow, "community_id" | "last_posted_at">[],
    posts: (posts ?? []) as Pick<SocialPostRow, "community_id" | "status">[],
  });
}

export async function getCommunityBySlug(
  supabase: TypedSupabaseClient,
  slug: string
): Promise<SocialCommunityRow | null> {
  const { data, error } = await supabase
    .from("social_communities")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load social community: ${error.message}`);
  }

  return (data as SocialCommunityRow | null) ?? null;
}

export async function getCommunityStats(
  supabase: TypedSupabaseClient,
  communityId: string
): Promise<{ actorCount: number; threadCount: number; postCount: number }> {
  const [{ count: threadCount, error: threadError }, { data: posts, error: postError }] =
    await Promise.all([
      supabase
        .from("social_threads")
        .select("*", { count: "exact", head: true })
        .eq("community_id", communityId),
      supabase
        .from("social_posts")
        .select("author_actor_id")
        .eq("community_id", communityId)
        .eq("status", "published"),
    ]);

  if (threadError) {
    throw new Error(`Failed to load community thread count: ${threadError.message}`);
  }

  if (postError) {
    throw new Error(`Failed to load community posts: ${postError.message}`);
  }

  const actorIds = new Set((posts ?? []).map((post) => post.author_actor_id).filter(Boolean));

  return {
    actorCount: actorIds.size,
    threadCount: threadCount ?? 0,
    postCount: posts?.length ?? 0,
  };
}
