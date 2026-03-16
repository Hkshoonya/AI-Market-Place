import type { TypedSupabaseClient } from "@/types/database";
import type {
  NetworkActorRow,
  SocialCommunityRow,
  SocialPostMediaRow,
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
  reputation_score?: number | null;
}

export interface FeedPostCard {
  id: string;
  content: string;
  created_at: string;
  language_code: string | null | undefined;
  status: SocialPostRow["status"];
  moderation_reason?: string | null;
  reply_count: number;
  media?: Array<{
    id: string;
    media_type: SocialPostMediaRow["media_type"];
    url: string;
    alt_text?: string | null;
  }>;
  linkPreviews?: Array<{
    id: string;
    url: string;
    label: string;
    source_type: string;
    source_host?: string | null;
    action_label?: string | null;
    handle?: string | null;
    tweet_id?: string | null;
  }>;
  author: FeedActorCard;
}

export interface FeedThreadCard {
  thread: SocialThreadRow & { community?: SocialCommunityRow | null };
  rootPost: FeedPostCard;
  replies: FeedPostCard[];
}

export type FeedMode = "top" | "latest" | "trusted";

interface MapFeedRowsInput {
  communities: Array<Pick<SocialCommunityRow, "id" | "slug" | "name"> & Partial<SocialCommunityRow>>;
  threads: SocialThreadRow[];
  rootPosts: SocialPostRow[];
  replies: SocialPostRow[];
  media?: SocialPostMediaRow[];
  actors: Array<
    Pick<
      NetworkActorRow,
      "id" | "actor_type" | "display_name" | "handle" | "avatar_url" | "trust_tier" | "reputation_score"
    >
  >;
}

function trustTierScore(trustTier: NetworkActorRow["trust_tier"]) {
  switch (trustTier) {
    case "verified":
      return 1;
    case "trusted":
      return 0.75;
    default:
      return 0.4;
  }
}

function reputationScore(value: number | null | undefined) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(numeric, 100)) / 100;
}

function recencyScore(timestamp: string) {
  const hoursAgo = Math.max(0, (Date.now() - new Date(timestamp).getTime()) / 3_600_000);
  return Math.max(0, 1 - Math.min(hoursAgo, 72) / 72);
}

function engagementScore(replyCount: number) {
  return Math.min(Math.max(replyCount, 0), 20) / 20;
}

function scoreThreadForMode(thread: FeedThreadCard, mode: Exclude<FeedMode, "latest">) {
  const trust = trustTierScore(thread.rootPost.author.trust_tier);
  const reputation = reputationScore(thread.rootPost.author.reputation_score);
  const recency = recencyScore(thread.thread.last_posted_at);
  const engagement = engagementScore(thread.thread.reply_count);

  if (mode === "trusted") {
    return trust * 0.55 + reputation * 0.25 + recency * 0.15 + engagement * 0.05;
  }

  return trust * 0.4 + reputation * 0.25 + recency * 0.25 + engagement * 0.1;
}

export function rankFeedThreads(threads: FeedThreadCard[], mode: FeedMode): FeedThreadCard[] {
  const ranked = [...threads];

  if (mode === "latest") {
    return ranked.sort(
      (left, right) =>
        new Date(right.thread.last_posted_at).getTime() - new Date(left.thread.last_posted_at).getTime()
    );
  }

  return ranked.sort((left, right) => scoreThreadForMode(right, mode) - scoreThreadForMode(left, mode));
}

export function mapFeedRows(input: MapFeedRowsInput): FeedThreadCard[] {
  const actorMap = new Map(input.actors.map((actor) => [actor.id, actor]));
  const communityMap = new Map(input.communities.map((community) => [community.id, community]));
  const rootPostMap = new Map(input.rootPosts.map((post) => [post.id, post]));
  const repliesByRoot = new Map<string, SocialPostRow[]>();
  const mediaByPostId = new Map<string, SocialPostMediaRow[]>();

  for (const reply of input.replies) {
    const parentId = reply.parent_post_id;
    if (!parentId) continue;
    const existing = repliesByRoot.get(parentId) ?? [];
    existing.push(reply);
    repliesByRoot.set(parentId, existing);
  }

  for (const media of input.media ?? []) {
    const existing = mediaByPostId.get(media.post_id) ?? [];
    existing.push(media);
    mediaByPostId.set(media.post_id, existing);
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
          media: (mediaByPostId.get(post.id) ?? [])
            .filter((item) => item.media_type === "image")
            .map((item) => ({
              id: item.id,
              media_type: item.media_type,
              url: item.url,
              alt_text: item.alt_text ?? null,
            })),
          linkPreviews: (mediaByPostId.get(post.id) ?? [])
            .filter((item) => item.media_type === "link_preview")
            .map((item) => {
              const metadata = (item.metadata ?? {}) as Record<string, unknown>;
              return {
                id: item.id,
                url: item.url,
                label:
                  typeof metadata.label === "string" && metadata.label
                    ? metadata.label
                    : "External link",
                source_type:
                  typeof metadata.source_type === "string" && metadata.source_type
                    ? metadata.source_type
                    : "link",
                source_host:
                  typeof metadata.source_host === "string" ? metadata.source_host : null,
                action_label:
                  typeof metadata.action_label === "string" ? metadata.action_label : null,
                handle: typeof metadata.handle === "string" ? metadata.handle : null,
                tweet_id: typeof metadata.tweet_id === "string" ? metadata.tweet_id : null,
              };
            }),
          author: {
            id: postAuthor.id,
            actor_type: postAuthor.actor_type,
            display_name: postAuthor.display_name,
            handle: postAuthor.handle,
            avatar_url: postAuthor.avatar_url ?? null,
            trust_tier: postAuthor.trust_tier,
            reputation_score: postAuthor.reputation_score ?? null,
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

async function loadFeedThreadCards(
  supabase: TypedSupabaseClient,
  threads: SocialThreadRow[],
  communities: SocialCommunityRow[]
): Promise<FeedThreadCard[]> {
  const rootPostIds = threads
    .map((thread) => thread.root_post_id)
    .filter((value): value is string => Boolean(value));
  const actorIds = new Set<string>();

  const [{ data: rootPosts, error: rootError }, { data: replies, error: replyError }] =
    await Promise.all([
      rootPostIds.length > 0
        ? supabase.from("social_posts").select("*").in("id", rootPostIds)
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

  const postIds = [
    ...(rootPosts ?? []).map((post) => post.id),
    ...(replies ?? []).map((post) => post.id),
  ];

  for (const rootPost of rootPosts ?? []) {
    actorIds.add(rootPost.author_actor_id);
  }
  for (const reply of replies ?? []) {
    actorIds.add(reply.author_actor_id);
  }

  const { data: actors, error: actorError } =
    actorIds.size > 0
      ? await supabase
          .from("network_actors")
          .select("id, actor_type, display_name, handle, avatar_url, trust_tier, reputation_score")
          .in("id", [...actorIds])
      : { data: [], error: null };

  if (actorError) {
    throw new Error(`Failed to load actors: ${actorError.message}`);
  }

  const { data: media, error: mediaError } =
    postIds.length > 0
      ? await supabase.from("social_post_media").select("*").in("post_id", postIds)
      : { data: [], error: null };

  if (mediaError) {
    throw new Error(`Failed to load post media: ${mediaError.message}`);
  }

  return mapFeedRows({
    communities,
    threads,
    rootPosts: (rootPosts ?? []) as SocialPostRow[],
    replies: (replies ?? []) as SocialPostRow[],
    media: (media ?? []) as SocialPostMediaRow[],
    actors: (actors ?? []) as NetworkActorRow[],
  });
}

export async function listPublicFeed(
  supabase: TypedSupabaseClient,
  options: { communitySlug?: string | null; limit?: number; mode?: FeedMode } = {}
): Promise<{ communities: SocialCommunityRow[]; threads: FeedThreadCard[] }> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  const mode = options.mode ?? "top";
  const candidateLimit = mode === "latest" ? limit : Math.min(limit * 4, 120);

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
    .limit(candidateLimit);

  if (selectedCommunity) {
    threadQuery = threadQuery.eq("community_id", selectedCommunity.id);
  }

  const { data: threads, error: threadError } = await threadQuery;
  if (threadError) {
    throw new Error(`Failed to load threads: ${threadError.message}`);
  }

  const mappedThreads = await loadFeedThreadCards(
    supabase,
    (threads ?? []) as SocialThreadRow[],
    (communities ?? []) as SocialCommunityRow[]
  );

  return {
    communities: (communities ?? []) as SocialCommunityRow[],
    threads: rankFeedThreads(mappedThreads, mode).slice(0, limit),
  };
}

export async function getPublicThreadDetail(
  supabase: TypedSupabaseClient,
  threadId: string
): Promise<FeedThreadCard | null> {
  const { data: thread, error: threadError } = await supabase
    .from("social_threads")
    .select("*")
    .eq("id", threadId)
    .maybeSingle();

  if (threadError) {
    throw new Error(`Failed to load thread: ${threadError.message}`);
  }

  if (!thread) {
    return null;
  }

  const { data: communities, error: communityError } = await supabase
    .from("social_communities")
    .select("*")
    .order("is_global", { ascending: false })
    .order("name", { ascending: true });

  if (communityError) {
    throw new Error(`Failed to load communities: ${communityError.message}`);
  }

  const mapped = await loadFeedThreadCards(
    supabase,
    [thread as SocialThreadRow],
    (communities ?? []) as SocialCommunityRow[]
  );

  return mapped[0] ?? null;
}

export async function listPublicActorThreads(
  supabase: TypedSupabaseClient,
  actorId: string,
  options: { limit?: number } = {}
): Promise<FeedThreadCard[]> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);

  const [{ data: communities, error: communityError }, { data: threads, error: threadError }] =
    await Promise.all([
      supabase
        .from("social_communities")
        .select("*")
        .order("is_global", { ascending: false })
        .order("name", { ascending: true }),
      supabase
        .from("social_threads")
        .select("*")
        .eq("created_by_actor_id", actorId)
        .order("last_posted_at", { ascending: false })
        .limit(limit),
    ]);

  if (communityError) {
    throw new Error(`Failed to load communities: ${communityError.message}`);
  }

  if (threadError) {
    throw new Error(`Failed to load actor threads: ${threadError.message}`);
  }

  return loadFeedThreadCards(
    supabase,
    (threads ?? []) as SocialThreadRow[],
    (communities ?? []) as SocialCommunityRow[]
  );
}
