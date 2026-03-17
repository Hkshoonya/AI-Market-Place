import type { TypedSupabaseClient } from "@/types/database";
import { getNewsSignalType, type NewsPresentationItem } from "@/lib/news/presentation";
import { getNewsSignalTrustBonus } from "@/lib/news/evidence";
import { buildActorHandle } from "@/lib/social/actors";
import { insertSocialPostLinkPreviews } from "@/lib/social/link-previews";
import type { NetworkActorRow } from "@/lib/schemas/social";

const DEFAULT_AGENT_SLUG = "pipeline-engineer";
const DEFAULT_COMMUNITY_SLUG = "models";
const BOOTSTRAP_LOOKBACK_HOURS = 24 * 7;
const DEFAULT_LOOKBACK_HOURS = 36;
const BOOTSTRAP_LIMIT = 6;
const DEFAULT_LIMIT = 3;
const SOURCE_QUERY_LIMIT = 20;
const SOURCE_PUBLISH_WINDOW_HOURS = 24;
const SIGNAL_SOURCE_ALLOWLIST = [
  "provider-blog",
  "x-twitter",
  "artificial-analysis",
  "open-llm-leaderboard",
  "arxiv",
  "hf-papers",
] as const;

type SourceName = (typeof SIGNAL_SOURCE_ALLOWLIST)[number];

const SOURCE_PUBLISH_CAP: Partial<Record<SourceName, number>> = {
  "provider-blog": 2,
  "x-twitter": 1,
};

export interface SignalPublisherCandidate extends NewsPresentationItem {
  id: string;
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function toTimestamp(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getNewsItemKey(item: Pick<SignalPublisherCandidate, "id" | "url" | "title">) {
  return item.id || item.url || item.title || "";
}

function buildSourceRunCap(source: string | null | undefined) {
  return SOURCE_PUBLISH_CAP[(source ?? "") as SourceName] ?? 1;
}

function formatSourceLabel(source: string | null | undefined) {
  switch (source) {
    case "provider-blog":
      return "Provider blog";
    case "x-twitter":
      return "X update";
    case "artificial-analysis":
      return "Artificial Analysis";
    case "open-llm-leaderboard":
      return "Open LLM Leaderboard";
    case "hf-papers":
      return "Hugging Face Papers";
    case "arxiv":
      return "arXiv";
    default:
      return "Public source";
  }
}

export function buildSignalThreadDraft(item: SignalPublisherCandidate): {
  title: string;
  content: string;
  metadata: Record<string, unknown>;
} {
  const signalType = getNewsSignalType(item);
  const provider = item.related_provider?.trim() || "AI ecosystem";
  const sourceLabel = formatSourceLabel(item.source);
  const title = truncate(
    item.title?.trim() || `${provider} ${signalType} update`,
    140
  );
  const summary = item.summary?.trim() || item.title?.trim() || "New public update detected.";
  const contentLines = [
    `${provider} ${signalType} signal`,
    "",
    summary,
    "",
    `Source: ${sourceLabel}`,
  ];

  if (item.url) {
    contentLines.push(`Original update: ${item.url}`);
  }

  return {
    title,
    content: contentLines.join("\n").trim(),
    metadata: {
      platform_published: true,
      news_item_id: item.id,
      signal_type: signalType,
      source: item.source ?? null,
      url: item.url ?? null,
      related_provider: item.related_provider ?? null,
      related_model_ids: item.related_model_ids ?? [],
      published_at: item.published_at ?? null,
    },
  };
}

export function pickSignalPublishCandidates(
  items: SignalPublisherCandidate[],
  alreadyPublishedKeys: Set<string>,
  options: {
    hasExistingThreads: boolean;
    existingSourceCounts?: Map<string, number>;
    now?: number;
  }
): SignalPublisherCandidate[] {
  const now = options.now ?? Date.now();
  const lookbackHours = options.hasExistingThreads
    ? DEFAULT_LOOKBACK_HOURS
    : BOOTSTRAP_LOOKBACK_HOURS;
  const minimumTimestamp = now - lookbackHours * 60 * 60 * 1000;
  const limit = options.hasExistingThreads ? DEFAULT_LIMIT : BOOTSTRAP_LIMIT;
  const perSourceCounts = new Map(options.existingSourceCounts ?? []);

  return [...items]
    .filter((item) => toTimestamp(item.published_at) >= minimumTimestamp)
    .filter((item) => !alreadyPublishedKeys.has(getNewsItemKey(item)))
    .sort((left, right) => {
      const trustDelta = getNewsSignalTrustBonus(right) - getNewsSignalTrustBonus(left);
      if (trustDelta !== 0) return trustDelta;
      return toTimestamp(right.published_at) - toTimestamp(left.published_at);
    })
    .filter((item) => {
      const source = item.source ?? "unknown";
      const nextCount = (perSourceCounts.get(source) ?? 0) + 1;
      if (nextCount > buildSourceRunCap(source)) {
        return false;
      }
      perSourceCounts.set(source, nextCount);
      return true;
    })
    .slice(0, limit);
}

async function getPlatformOwnerId(supabase: TypedSupabaseClient): Promise<string> {
  const configuredOwnerId = process.env.SOCIAL_SYSTEM_OWNER_ID?.trim();
  if (configuredOwnerId) return configuredOwnerId;

  const { data: adminProfile, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_admin", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve social system owner: ${error.message}`);
  }

  if (!adminProfile?.id) {
    throw new Error("No admin profile is available to own platform social actors.");
  }

  return adminProfile.id;
}

export async function resolveOrCreatePlatformAgentActor(
  supabase: TypedSupabaseClient,
  agentSlug = DEFAULT_AGENT_SLUG
): Promise<NetworkActorRow> {
  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id, slug, name, description, owner_id")
    .eq("slug", agentSlug)
    .single();

  if (agentError || !agent) {
    throw new Error(`Failed to load platform agent ${agentSlug}: ${agentError?.message ?? "missing"}`);
  }

  const handle = buildActorHandle({
    actorType: "agent",
    agentSlug: agent.slug,
    displayName: agent.name,
    fallbackId: agent.id.slice(0, 8),
  });

  const { data: existingByAgentId, error: existingByAgentIdError } = await supabase
    .from("network_actors")
    .select("*")
    .eq("agent_id", agent.id)
    .maybeSingle();

  if (existingByAgentIdError) {
    throw new Error(
      `Failed to load platform actor ${agentSlug}: ${existingByAgentIdError.message}`
    );
  }

  if (existingByAgentId) {
    return existingByAgentId as NetworkActorRow;
  }

  const { data: existingByHandle, error: existingByHandleError } = await supabase
    .from("network_actors")
    .select("*")
    .eq("handle", handle)
    .eq("actor_type", "agent")
    .maybeSingle();

  if (existingByHandleError) {
    throw new Error(
      `Failed to load platform actor by handle ${agentSlug}: ${existingByHandleError.message}`
    );
  }

  if (existingByHandle) {
    return existingByHandle as NetworkActorRow;
  }

  const ownerUserId = agent.owner_id ?? (await getPlatformOwnerId(supabase));

  const { data: created, error: createError } = await supabase
    .from("network_actors")
    .insert({
      actor_type: "agent",
      owner_user_id: ownerUserId,
      agent_id: agent.id,
      display_name: agent.name,
      handle,
      bio: agent.description ?? "Platform-managed agent publisher for trusted updates.",
      trust_tier: "verified",
      reputation_score: 80,
      autonomy_enabled: true,
      is_public: true,
      metadata: {
        platform_managed: true,
        social_role: "signal_publisher",
      },
    })
    .select("*")
    .single();

  if (createError || !created) {
    throw new Error(`Failed to create platform actor ${agentSlug}: ${createError?.message ?? "unknown"}`);
  }

  return created as NetworkActorRow;
}

async function listCandidateNews(
  supabase: TypedSupabaseClient
): Promise<SignalPublisherCandidate[]> {
  const results = await Promise.all(
    SIGNAL_SOURCE_ALLOWLIST.map(async (source) => {
      const { data, error } = await supabase
        .from("model_news")
        .select(
          "id, title, summary, url, source, category, related_provider, related_model_ids, published_at, metadata"
        )
        .eq("source", source)
        .order("published_at", { ascending: false })
        .limit(SOURCE_QUERY_LIMIT);

      if (error) {
        throw new Error(
          `Failed to load candidate news for commons publishing (${source}): ${error.message}`
        );
      }

      return (data ?? []) as SignalPublisherCandidate[];
    })
  );

  const deduped = new Map<string, SignalPublisherCandidate>();
  for (const row of results.flat()) {
    const key = getNewsItemKey(row);
    if (!key || deduped.has(key)) continue;
    deduped.set(key, row);
  }

  return [...deduped.values()]
    .filter((item) => Boolean(item.id) && Boolean(item.title || item.summary || item.url))
    .sort((left, right) => toTimestamp(right.published_at) - toTimestamp(left.published_at))
    .slice(0, SIGNAL_SOURCE_ALLOWLIST.length * SOURCE_QUERY_LIMIT);
}

async function listPublishedSignalKeys(
  supabase: TypedSupabaseClient,
  actorId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("social_threads")
    .select("metadata")
    .eq("created_by_actor_id", actorId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    throw new Error(`Failed to load published commons signals: ${error.message}`);
  }

  const keys = new Set<string>();
  for (const row of data ?? []) {
    const metadata =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : null;
    const newsItemId =
      typeof metadata?.news_item_id === "string" ? metadata.news_item_id : null;
    const url = typeof metadata?.url === "string" ? metadata.url : null;
    if (newsItemId) keys.add(newsItemId);
    if (url) keys.add(url);
  }

  return keys;
}

async function listRecentPublishedSourceCounts(
  supabase: TypedSupabaseClient,
  actorId: string
): Promise<Map<string, number>> {
  const cutoff = new Date(
    Date.now() - SOURCE_PUBLISH_WINDOW_HOURS * 60 * 60 * 1000
  ).toISOString();
  const { data, error } = await supabase
    .from("social_threads")
    .select("metadata")
    .eq("created_by_actor_id", actorId)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(`Failed to load recent published source counts: ${error.message}`);
  }

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const metadata =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : null;
    const source = typeof metadata?.source === "string" ? metadata.source : null;
    if (!source) continue;
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }

  return counts;
}

async function resolveCommunityId(
  supabase: TypedSupabaseClient,
  communitySlug: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("social_communities")
    .select("id")
    .eq("slug", communitySlug)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve social community ${communitySlug}: ${error.message}`);
  }

  return data?.id ?? null;
}

export async function publishRecentSignalsToCommons(
  supabase: TypedSupabaseClient,
  options: { agentSlug?: string; communitySlug?: string } = {}
): Promise<{
  actorHandle: string;
  candidateCount: number;
  publishedCount: number;
  publishedNewsIds: string[];
  skippedExistingCount: number;
}> {
  const actor = await resolveOrCreatePlatformAgentActor(
    supabase,
    options.agentSlug ?? DEFAULT_AGENT_SLUG
  );
  const communityId = await resolveCommunityId(
    supabase,
    options.communitySlug ?? DEFAULT_COMMUNITY_SLUG
  );
  const [candidateItems, existingKeys, existingSourceCounts, { count: existingThreadCount }] =
    await Promise.all([
    listCandidateNews(supabase),
    listPublishedSignalKeys(supabase, actor.id),
    listRecentPublishedSourceCounts(supabase, actor.id),
    supabase.from("social_threads").select("*", { count: "exact", head: true }),
    ]);

  const candidates = pickSignalPublishCandidates(candidateItems, existingKeys, {
    hasExistingThreads: (existingThreadCount ?? 0) > 0,
    existingSourceCounts,
  });
  const publishedNewsIds: string[] = [];

  for (const item of candidates) {
    const draft = buildSignalThreadDraft(item);
    const postedAt = new Date().toISOString();

    const { data: thread, error: threadError } = await supabase
      .from("social_threads")
      .insert({
        created_by_actor_id: actor.id,
        community_id: communityId,
        title: draft.title,
        visibility: communityId ? "community" : "public",
        language_code: "en",
        reply_count: 0,
        last_posted_at: postedAt,
        metadata: {
          ...draft.metadata,
          url: item.url ?? null,
        },
      })
      .select("*")
      .single();

    if (threadError || !thread) {
      throw new Error(`Failed to create commons signal thread: ${threadError?.message ?? "unknown"}`);
    }

    const { data: post, error: postError } = await supabase
      .from("social_posts")
      .insert({
        thread_id: thread.id,
        parent_post_id: null,
        author_actor_id: actor.id,
        community_id: communityId,
        content: draft.content,
        language_code: "en",
        status: "published",
        reply_count: 0,
        metadata: draft.metadata,
      })
      .select("*")
      .single();

    if (postError || !post) {
      throw new Error(`Failed to create commons signal post: ${postError?.message ?? "unknown"}`);
    }

    await insertSocialPostLinkPreviews(supabase, post.id, draft.content);
    await supabase
      .from("social_threads")
      .update({
        root_post_id: post.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", thread.id);

    publishedNewsIds.push(item.id);
  }

  return {
    actorHandle: actor.handle,
    candidateCount: candidateItems.length,
    publishedCount: publishedNewsIds.length,
    publishedNewsIds,
    skippedExistingCount: existingKeys.size,
  };
}
