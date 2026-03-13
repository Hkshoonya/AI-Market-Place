import type { TypedSupabaseClient } from "@/types/database";
import type {
  NetworkActorRow,
  SocialCommunityRow,
  SocialPostRow,
  SocialThreadRow,
} from "@/lib/schemas/social";

export interface FeedActorCard {
  id: string;
  actor_type: NetworkActorRow["actor_type"];
  display_name: string;
  handle: string;
  avatar_url: string | null;
  trust_tier: NetworkActorRow["trust_tier"];
}

export interface FeedPostCard {
  id: string;
  content: string;
  created_at: string;
  language_code: string | null | undefined;
  status: SocialPostRow["status"];
  moderation_reason?: string | null;
  reply_count: number;
  author: FeedActorCard;
}

export interface FeedThreadCard {
  thread: SocialThreadRow & { community?: SocialCommunityRow | null };
  rootPost: FeedPostCard;
  replies: FeedPostCard[];
}

interface MapFeedRowsInput {
  communities: Array<Pick<SocialCommunityRow, "id" | "slug" | "name"> & Partial<SocialCommunityRow>>;
  threads: SocialThreadRow[];
  rootPosts: SocialPostRow[];
  replies: SocialPostRow[];
  actors: Array<
    Pick<NetworkActorRow, "id" | "actor_type" | "display_name" | "handle" | "avatar_url" | "trust_tier">
  >;
}

export function mapFeedRows(input: MapFeedRowsInput): FeedThreadCard[] {
  const actorMap = new Map(input.actors.map((actor) => [actor.id, actor]));
  const communityMap = new Map(input.communities.map((community) => [community.id, community]));
  const rootPostMap = new Map(input.rootPosts.map((post) => [post.id, post]));
  const repliesByRoot = new Map<string, SocialPostRow[]>();

  for (const reply of input.replies) {
    const parentId = reply.parent_post_id;
    if (!parentId) continue;
    const existing = repliesByRoot.get(parentId) ?? [];
    existing.push(reply);
    repliesByRoot.set(parentId, existing);
  }

  const mapped = input.threads.map((thread): FeedThreadCard | null => {
      if (!thread.root_post_id) return null;
      const rootPost = rootPostMap.get(thread.root_post_id);
      if (!rootPost) return null;
      const author = actorMap.get(rootPost.author_actor_id);
      if (!author) return null;

      const mapPost = (post: SocialPostRow): FeedPostCard | null => {
        const postAuthor = actorMap.get(post.author_actor_id);
        if (!postAuthor) return null;
        const moderationReason =
          typeof post.metadata?.moderation_reason === "string"
            ? post.metadata.moderation_reason
            : null;
        const isRemovedRoot = post.parent_post_id === null && post.status === "removed";
        const isRemovedReply = post.parent_post_id !== null && post.status !== "published";

        if (isRemovedReply) return null;

        return {
          id: post.id,
          content: isRemovedRoot ? "Removed by moderation" : post.content,
          created_at: post.created_at,
          language_code: post.language_code,
          status: post.status,
          moderation_reason: moderationReason,
          reply_count: post.reply_count,
          author: {
            id: postAuthor.id,
            actor_type: postAuthor.actor_type,
            display_name: postAuthor.display_name,
            handle: postAuthor.handle,
            avatar_url: postAuthor.avatar_url ?? null,
            trust_tier: postAuthor.trust_tier,
          },
        };
      };

      const mappedRoot = mapPost(rootPost);
      if (!mappedRoot) return null;

      return {
        thread: {
          ...thread,
          community: thread.community_id ? (communityMap.get(thread.community_id) ?? null) : null,
        },
        rootPost: mappedRoot,
        replies: (repliesByRoot.get(rootPost.id) ?? [])
          .map(mapPost)
          .filter((reply): reply is FeedPostCard => Boolean(reply)),
      };
    });

  return mapped.filter((item): item is FeedThreadCard => item !== null);
}

export async function listPublicFeed(
  supabase: TypedSupabaseClient,
  options: { communitySlug?: string | null; limit?: number } = {}
): Promise<{ communities: SocialCommunityRow[]; threads: FeedThreadCard[] }> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);

  const { data: communities, error: communityError } = await supabase
    .from("social_communities")
    .select("*")
    .order("is_global", { ascending: false })
    .order("name", { ascending: true });

  if (communityError) {
    throw new Error(`Failed to load communities: ${communityError.message}`);
  }

  const selectedCommunity =
    options.communitySlug && options.communitySlug !== "global"
      ? (communities ?? []).find((community) => community.slug === options.communitySlug) ?? null
      : null;

  let threadQuery = supabase
    .from("social_threads")
    .select("*")
    .order("last_posted_at", { ascending: false })
    .limit(limit);

  if (selectedCommunity) {
    threadQuery = threadQuery.eq("community_id", selectedCommunity.id);
  }

  const { data: threads, error: threadError } = await threadQuery;
  if (threadError) {
    throw new Error(`Failed to load threads: ${threadError.message}`);
  }

  const rootPostIds = (threads ?? [])
    .map((thread) => thread.root_post_id)
    .filter((value): value is string => Boolean(value));
  const actorIds = new Set<string>();

  const [{ data: rootPosts, error: rootError }, { data: replies, error: replyError }] =
    await Promise.all([
      rootPostIds.length > 0
        ? supabase.from("social_posts").select("*").in("id", rootPostIds).eq("status", "published")
        : Promise.resolve({ data: [], error: null }),
      rootPostIds.length > 0
        ? supabase
            .from("social_posts")
            .select("*")
            .in("parent_post_id", rootPostIds)
            .eq("status", "published")
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (rootError) {
    throw new Error(`Failed to load root posts: ${rootError.message}`);
  }
  if (replyError) {
    throw new Error(`Failed to load replies: ${replyError.message}`);
  }

  for (const rootPost of rootPosts ?? []) {
    actorIds.add(rootPost.author_actor_id);
  }
  for (const reply of replies ?? []) {
    actorIds.add(reply.author_actor_id);
  }

  const { data: actors, error: actorError } =
    actorIds.size > 0
      ? await supabase.from("network_actors").select("*").in("id", [...actorIds])
      : { data: [], error: null };

  if (actorError) {
    throw new Error(`Failed to load actors: ${actorError.message}`);
  }

  return {
    communities: (communities ?? []) as SocialCommunityRow[],
    threads: mapFeedRows({
      communities: (communities ?? []) as SocialCommunityRow[],
      threads: (threads ?? []) as SocialThreadRow[],
      rootPosts: (rootPosts ?? []) as SocialPostRow[],
      replies: (replies ?? []) as SocialPostRow[],
      actors: (actors ?? []) as NetworkActorRow[],
    }),
  };
}
