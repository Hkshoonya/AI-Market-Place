import type { TypedSupabaseClient } from "@/types/database";
import {
  buildLaunchRadar,
  getNewsSignalType,
  summarizeNewsSignals,
  type LaunchRadarItem,
  type NewsPresentationItem,
  type NewsSignalBucket,
} from "@/lib/news/presentation";

type CommonsSignalCommunity = "global" | "launches" | "models";

interface CommonsSignalConfig {
  title: string;
  description: string;
  allowedSignals: Set<string>;
}

export interface CommonsSignalFeed {
  title: string;
  description: string;
  summary: NewsSignalBucket[];
  radar: LaunchRadarItem[];
}

const BASE_SIGNAL_SOURCES = [
  "x-twitter",
  "provider-blog",
  "arxiv",
  "hf-papers",
  "artificial-analysis",
  "open-llm-leaderboard",
] as const;

const SIGNAL_CONFIG: Record<CommonsSignalCommunity, CommonsSignalConfig> = {
  global: {
    title: "Signal board",
    description:
      "Recent launch, pricing, benchmark, and research signals flowing into the commons from synced public sources.",
    allowedSignals: new Set([
      "launch",
      "pricing",
      "benchmark",
      "api",
      "open_source",
      "research",
      "safety",
    ]),
  },
  launches: {
    title: "Launches signal board",
    description:
      "Fresh provider and X updates for launches, pricing moves, API changes, and benchmark wins.",
    allowedSignals: new Set(["launch", "pricing", "benchmark", "api", "open_source"]),
  },
  models: {
    title: "Model update board",
    description:
      "High-signal model updates spanning launches, benchmarks, research, pricing, and API capability changes.",
    allowedSignals: new Set(["launch", "pricing", "benchmark", "api", "research", "open_source"]),
  },
};

function getSignalConfig(
  communitySlug: string
): CommonsSignalConfig | null {
  if (communitySlug === "global") return SIGNAL_CONFIG.global;
  if (communitySlug === "launches") return SIGNAL_CONFIG.launches;
  if (communitySlug === "models") return SIGNAL_CONFIG.models;
  return null;
}

function mapNewsItem(item: Record<string, unknown>): NewsPresentationItem {
  return {
    id: typeof item.id === "string" ? item.id : null,
    title: typeof item.title === "string" ? item.title : null,
    summary: typeof item.summary === "string" ? item.summary : null,
    url: typeof item.url === "string" ? item.url : null,
    source: typeof item.source === "string" ? item.source : null,
    category: typeof item.category === "string" ? item.category : null,
    related_provider:
      typeof item.related_provider === "string" ? item.related_provider : null,
    related_model_ids: Array.isArray(item.related_model_ids)
      ? (item.related_model_ids as string[])
      : null,
    published_at:
      typeof item.published_at === "string" ? item.published_at : null,
    metadata:
      item.metadata && typeof item.metadata === "object"
        ? (item.metadata as Record<string, unknown>)
        : null,
  };
}

export function buildCommonsSignalFeed(
  items: NewsPresentationItem[],
  communitySlug: string,
  limit = 5
): CommonsSignalFeed | null {
  const config = getSignalConfig(communitySlug);
  if (!config) return null;

  const filtered = items.filter((item) =>
    config.allowedSignals.has(getNewsSignalType(item))
  );

  if (filtered.length === 0) {
    return {
      title: config.title,
      description: config.description,
      summary: [],
      radar: [],
    };
  }

  return {
    title: config.title,
    description: config.description,
    summary: summarizeNewsSignals(filtered).filter((bucket) =>
      config.allowedSignals.has(bucket.type)
    ),
    radar: buildLaunchRadar(filtered, limit),
  };
}

export async function listCommonsSignalFeed(
  supabase: TypedSupabaseClient,
  communitySlug: string,
  limit = 5
): Promise<CommonsSignalFeed | null> {
  const config = getSignalConfig(communitySlug);
  if (!config) return null;

  const { data, error } = await supabase
    .from("model_news")
    .select(
      "id, title, summary, url, source, category, related_provider, related_model_ids, published_at, metadata"
    )
    .in("source", [...BASE_SIGNAL_SOURCES])
    .order("published_at", { ascending: false })
    .limit(40);

  if (error) {
    throw new Error(`Failed to load commons signal feed: ${error.message}`);
  }

  return buildCommonsSignalFeed(
    ((data ?? []) as Record<string, unknown>[]).map(mapNewsItem),
    communitySlug,
    limit
  );
}
