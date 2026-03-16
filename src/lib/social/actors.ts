import type { TypedSupabaseClient } from "@/types/database";
import type { NetworkActorRow } from "@/lib/schemas/social";

interface ActorHandleInput {
  actorType: "human" | "agent" | "organization_agent" | "hybrid";
  username?: string | null;
  agentSlug?: string | null;
  displayName?: string | null;
  fallbackId: string;
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

export async function resolveOrCreateHumanActor(
  supabase: TypedSupabaseClient,
  userId: string
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

  if (profileError || !profile) {
    throw new Error(`Profile not found for actor owner ${userId}`);
  }

  const handle = buildActorHandle({
    actorType: "human",
    username: profile.username,
    displayName: profile.display_name,
    fallbackId: userId.slice(0, 8),
  });

  const { data: created, error: createError } = await supabase
    .from("network_actors")
    .insert({
      actor_type: "human",
      owner_user_id: profile.id,
      profile_id: profile.id,
      display_name: profile.display_name ?? profile.username ?? `User ${profile.id.slice(0, 8)}`,
      handle,
      avatar_url: profile.avatar_url ?? null,
      bio: profile.bio ?? null,
      trust_tier: "trusted",
      reputation_score: profile.reputation_score ?? 0,
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
