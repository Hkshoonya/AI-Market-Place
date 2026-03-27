import type { TypedSupabaseClient } from "@/types/database";
import type { NetworkActorRow, SocialPostRow, SocialThreadRow } from "@/lib/schemas/social";

interface ActorHandleInput {
  actorType: "human" | "agent" | "organization_agent" | "hybrid";
  username?: string | null;
  agentSlug?: string | null;
  displayName?: string | null;
  fallbackId: string;
}

interface HumanActorSeed {
  email?: string | null;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export interface PublicActorDirectoryItem extends NetworkActorRow {
  threadCount: number;
  postCount: number;
  lastPostedAt: string | null;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function buildActorHandle(input: ActorHandleInput): string {
  if (input.username) return slugify(input.username);
  if (input.agentSlug) return slugify(input.agentSlug);
  if (input.displayName) return slugify(input.displayName);
  const prefix = input.actorType === "human" ? "user" : "actor";
  return `${prefix}-${slugify(input.fallbackId)}`;
}

export async function canActorReplyToThread(
  supabase: TypedSupabaseClient,
  threadId: string,
  actorId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const { data, error } = await supabase
    .from("social_thread_blocks")
    .select("id")
    .eq("thread_id", threadId)
    .eq("blocked_actor_id", actorId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check thread block: ${error.message}`);
  }

  if (data) {
    return { allowed: false, reason: "Actor is blocked in this thread." };
  }

  return { allowed: true };
}

export async function getPublicActorByHandle(
  supabase: TypedSupabaseClient,
  handle: string
): Promise<NetworkActorRow | null> {
  const { data, error } = await supabase
    .from("network_actors")
    .select("*")
    .eq("handle", handle)
    .eq("is_public", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load public actor: ${error.message}`);
  }

  return (data as NetworkActorRow | null) ?? null;
}

export async function getPublicActorStats(
  supabase: TypedSupabaseClient,
  actorId: string
): Promise<{ threadCount: number; postCount: number }> {
  const [{ count: threadCount, error: threadError }, { count: postCount, error: postError }] =
    await Promise.all([
      supabase
        .from("social_threads")
        .select("*", { count: "exact", head: true })
        .eq("created_by_actor_id", actorId),
      supabase
        .from("social_posts")
        .select("*", { count: "exact", head: true })
        .eq("author_actor_id", actorId)
        .eq("status", "published"),
    ]);

  if (threadError) {
    throw new Error(`Failed to load actor thread count: ${threadError.message}`);
  }

  if (postError) {
    throw new Error(`Failed to load actor post count: ${postError.message}`);
  }

  return {
    threadCount: threadCount ?? 0,
    postCount: postCount ?? 0,
  };
}

function trustOrder(tier: NetworkActorRow["trust_tier"]) {
  switch (tier) {
    case "verified":
      return 3;
    case "trusted":
      return 2;
    default:
      return 1;
  }
}

function byNewest(first: string | null, second: string | null) {
  if (!first && !second) return 0;
  if (!first) return 1;
  if (!second) return -1;
  return new Date(second).getTime() - new Date(first).getTime();
}

export function buildPublicActorDirectory(input: {
  actors: NetworkActorRow[];
  threadRows: Array<Pick<SocialThreadRow, "created_by_actor_id" | "last_posted_at">>;
  postRows: Array<Pick<SocialPostRow, "author_actor_id" | "status">>;
}): PublicActorDirectoryItem[] {
  const items: PublicActorDirectoryItem[] = input.actors.map((actor) => ({
    ...actor,
    threadCount: 0,
    postCount: 0,
    lastPostedAt: null,
  }));

  const itemMap = new Map(items.map((item) => [item.id, item]));

  for (const thread of input.threadRows) {
    const item = itemMap.get(thread.created_by_actor_id);
    if (!item) continue;
    item.threadCount += 1;
    if (!item.lastPostedAt || new Date(thread.last_posted_at).getTime() > new Date(item.lastPostedAt).getTime()) {
      item.lastPostedAt = thread.last_posted_at;
    }
  }

  for (const post of input.postRows) {
    if (post.status !== "published") continue;
    const item = itemMap.get(post.author_actor_id);
    if (!item) continue;
    item.postCount += 1;
  }

  return items.sort((left, right) => {
    const trustDiff = trustOrder(right.trust_tier) - trustOrder(left.trust_tier);
    if (trustDiff !== 0) return trustDiff;

    const reputationDiff = (right.reputation_score ?? 0) - (left.reputation_score ?? 0);
    if (reputationDiff !== 0) return reputationDiff;

    if (right.threadCount !== left.threadCount) return right.threadCount - left.threadCount;
    if (right.postCount !== left.postCount) return right.postCount - left.postCount;

    const recencyDiff = byNewest(left.lastPostedAt, right.lastPostedAt);
    if (recencyDiff !== 0) return recencyDiff;

    return left.display_name.localeCompare(right.display_name);
  });
}

export async function listPublicActorDirectory(
  supabase: TypedSupabaseClient,
  options: { limit?: number } = {}
): Promise<PublicActorDirectoryItem[]> {
  const limit = Math.min(Math.max(options.limit ?? 40, 1), 200);
  const [{ data: actors, error: actorError }, { data: threadRows, error: threadError }, { data: postRows, error: postError }] =
    await Promise.all([
      supabase
        .from("network_actors")
        .select("*")
        .eq("is_public", true)
        .limit(limit),
      supabase.from("social_threads").select("created_by_actor_id, last_posted_at"),
      supabase.from("social_posts").select("author_actor_id, status"),
    ]);

  if (actorError) {
    throw new Error(`Failed to load public actors: ${actorError.message}`);
  }

  if (threadError) {
    throw new Error(`Failed to load actor threads: ${threadError.message}`);
  }

  if (postError) {
    throw new Error(`Failed to load actor posts: ${postError.message}`);
  }

  return buildPublicActorDirectory({
    actors: (actors ?? []) as NetworkActorRow[],
    threadRows: (threadRows ?? []) as Array<
      Pick<SocialThreadRow, "created_by_actor_id" | "last_posted_at">
    >,
    postRows: (postRows ?? []) as Array<
      Pick<SocialPostRow, "author_actor_id" | "status">
    >,
  });
}

export async function resolveOrCreateHumanActor(
  supabase: TypedSupabaseClient,
  userId: string,
  seed: HumanActorSeed = {}
): Promise<NetworkActorRow> {
  const { data: existing, error: existingError } = await supabase
    .from("network_actors")
    .select("*")
    .eq("profile_id", userId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to load human actor: ${existingError.message}`);
  }
  if (existing) return existing as NetworkActorRow;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio, reputation_score")
    .eq("id", userId)
    .single();

  let resolvedProfile = profile;

  if (profileError || !profile) {
    const fallbackUsername =
      seed.username ??
      (seed.email ? seed.email.split("@")[0] : null) ??
      `user-${userId.slice(0, 8)}`;
    const fallbackDisplayName = seed.displayName ?? fallbackUsername;

    const { data: insertedProfile, error: insertProfileError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          email: seed.email ?? null,
          username: fallbackUsername,
          display_name: fallbackDisplayName,
          avatar_url: seed.avatarUrl ?? null,
        },
        { onConflict: "id" }
      )
      .select("id, username, display_name, avatar_url, bio, reputation_score")
      .single();

    if (insertProfileError || !insertedProfile) {
      throw new Error(
        `Profile not found for actor owner ${userId}: ${insertProfileError?.message ?? "unable to create fallback profile"}`
      );
    }

    resolvedProfile = insertedProfile;
  }

  if (!resolvedProfile) {
    throw new Error(`Profile not found for actor owner ${userId}`);
  }

  const handle = buildActorHandle({
    actorType: "human",
    username: resolvedProfile.username,
    displayName: resolvedProfile.display_name,
    fallbackId: userId.slice(0, 8),
  });

  const { data: created, error: createError } = await supabase
    .from("network_actors")
    .insert({
      actor_type: "human",
      owner_user_id: resolvedProfile.id,
      profile_id: resolvedProfile.id,
      display_name:
        resolvedProfile.display_name ??
        resolvedProfile.username ??
        `User ${resolvedProfile.id.slice(0, 8)}`,
      handle,
      avatar_url: resolvedProfile.avatar_url ?? null,
      bio: resolvedProfile.bio ?? null,
      trust_tier: "trusted",
      reputation_score: resolvedProfile.reputation_score ?? 0,
      autonomy_enabled: true,
      metadata: {},
    })
    .select("*")
    .single();

  if (createError || !created) {
    throw new Error(`Failed to create human actor: ${createError?.message ?? "unknown"}`);
  }

  return created as NetworkActorRow;
}

export async function resolveAgentActorFromApiKeyRecord(
  supabase: TypedSupabaseClient,
  keyRecord: Record<string, unknown>
): Promise<NetworkActorRow | null> {
  const agentId =
    typeof keyRecord.agent_id === "string" && keyRecord.agent_id
      ? keyRecord.agent_id
      : null;

  if (!agentId) return null;

  const { data: existing, error: existingError } = await supabase
    .from("network_actors")
    .select("*")
    .eq("agent_id", agentId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to load agent actor: ${existingError.message}`);
  }
  if (existing) return existing as NetworkActorRow;

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id, slug, name, description, owner_id")
    .eq("id", agentId)
    .single();

  if (agentError || !agent) {
    throw new Error(`Agent not found for actor ${agentId}`);
  }
  if (!agent.owner_id) {
    throw new Error(`Agent ${agent.slug} does not have an owner_id`);
  }

  const { data: created, error: createError } = await supabase
    .from("network_actors")
    .insert({
      actor_type: "agent",
      owner_user_id: agent.owner_id,
      agent_id: agent.id,
      display_name: agent.name,
      handle: buildActorHandle({
        actorType: "agent",
        agentSlug: agent.slug,
        displayName: agent.name,
        fallbackId: agent.id.slice(0, 8),
      }),
      bio: agent.description ?? null,
      trust_tier: "basic",
      autonomy_enabled: true,
      metadata: {},
    })
    .select("*")
    .single();

  if (createError || !created) {
    throw new Error(`Failed to create agent actor: ${createError?.message ?? "unknown"}`);
  }

  return created as NetworkActorRow;
}
