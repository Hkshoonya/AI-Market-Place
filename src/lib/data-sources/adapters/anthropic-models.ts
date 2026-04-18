/**
 * Anthropic Models Adapter
 *
 * Data sourcing strategy (highest to lowest priority):
 *   1. Live Anthropic API  — if ANTHROPIC_API_KEY is present in ctx.secrets
 *   2. Public HTML scrape  — https://docs.anthropic.com/en/docs/about-claude/models
 *   3. Static known-models data — always available, guarantees at least one sync
 *
 * No API key is required. The static map alone is sufficient to produce a
 * complete, meaningful sync of all current Claude models.
 */

import type { DataSourceAdapter } from "../types";
import { registerAdapter } from "../registry";
import { fetchWithRetry } from "../utils";
import {
  buildRecord,
  type KnownModelMeta,
  type ProviderDefaults,
} from "../shared/build-record";
import {
  ANTHROPIC_KNOWN_MODELS,
  canonicalizeAnthropicModelId,
  resolveAnthropicKnownModelMeta,
} from "../shared/known-models/anthropic";
import { createAdapterSyncer } from "../shared/adapter-syncer";

// ---------------------------------------------------------------------------
// Provider-level defaults (all Claude models share these)
// ---------------------------------------------------------------------------

const PROVIDER_DEFAULTS: ProviderDefaults = {
  provider: "Anthropic",
  slugPrefix: "anthropic",
  category: "multimodal",
  modalities: ["text", "image"],
  is_open_weights: false,
  license: "commercial",
  license_name: "Proprietary",
};

function parseReleaseDateFromModelId(modelId: string): string | undefined {
  const compactMatch = modelId.match(/-(20\d{2})(\d{2})(\d{2})(?:-v\d+)?$/);
  if (!compactMatch) return undefined;

  return `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`;
}

/** Bound buildRecord — pre-fills provider defaults and known data lookup. */
function boundBuildRecord(
  modelId: string,
  overrides: Partial<KnownModelMeta> = {}
): Record<string, unknown> {
  const canonicalModelId = canonicalizeAnthropicModelId(modelId);
  const releaseDate = parseReleaseDateFromModelId(canonicalModelId);
  return buildRecord(
    canonicalModelId,
    resolveAnthropicKnownModelMeta(canonicalModelId),
    {
      ...overrides,
      release_date: overrides.release_date ?? releaseDate,
    },
    PROVIDER_DEFAULTS
  );
}

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------

interface AnthropicModelEntry {
  id: string;
  type: string;
  display_name: string;
  created_at: string;
}

interface AnthropicModelsPage {
  data: AnthropicModelEntry[];
  has_more: boolean;
  last_id: string | null;
}

// ---------------------------------------------------------------------------
// Provider-specific fetch and scrape functions
// ---------------------------------------------------------------------------

/**
 * Fetch all model IDs from the Anthropic /v1/models API (handles pagination).
 * Returns null on any failure so the caller can fall back gracefully.
 */
async function tryFetchLiveApi(
  apiKey: string,
  signal?: AbortSignal
): Promise<Map<string, { displayName: string; createdAt: string }> | null> {
  const result = new Map<string, { displayName: string; createdAt: string }>();
  let afterId: string | undefined;
  let hasMore = true;

  try {
    while (hasMore) {
      const url = new URL("https://api.anthropic.com/v1/models");
      url.searchParams.set("limit", "100");
      if (afterId) url.searchParams.set("after_id", afterId);

      const res = await fetchWithRetry(
        url.toString(),
        {
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          signal,
        },
        { maxRetries: 2, signal }
      );

      if (!res.ok) return null;

      const json: AnthropicModelsPage = await res.json();
      for (const entry of json.data ?? []) {
        result.set(entry.id, {
          displayName: entry.display_name,
          createdAt: entry.created_at,
        });
      }

      hasMore = json.has_more === true && !!json.last_id;
      if (hasMore) afterId = json.last_id!;
    }

    return result;
  } catch {
    return null;
  }
}

/**
 * Try to scrape the Anthropic models documentation page for model IDs.
 * Returns an empty array on failure.
 */
async function tryScrapeDocsPage(signal?: AbortSignal): Promise<string[]> {
  try {
    const res = await fetchWithRetry(
      "https://docs.anthropic.com/en/docs/about-claude/models",
      {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ModelIndexBot/1.0)" },
        signal,
      },
      { maxRetries: 1, signal }
    );
    if (!res.ok) return [];

    const html = await res.text();
    const modelPattern =
      /\b(claude-(?:opus|sonnet|haiku|instant)[-\w.]*|claude-\d[\w.-]*)\b/g;

    const found = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = modelPattern.exec(html)) !== null) {
      found.add(match[1]);
    }

    return [...found].filter((modelId) => {
      if (/^claude-(computer-use|4|4-6)$/.test(modelId)) {
        return false;
      }
      return true;
    });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Enrich function — applies Anthropic API results to the record map
// ---------------------------------------------------------------------------

function enrichFromApi(
  recordMap: Map<string, Record<string, unknown>>,
  apiResult: Map<string, { displayName: string; createdAt: string }>,
  now: string,
  buildRecordFn: (
    modelId: string,
    overrides?: Partial<KnownModelMeta>
  ) => Record<string, unknown>
): void {
  for (const [modelId, meta] of apiResult) {
    if (!recordMap.has(modelId)) {
      recordMap.set(
        modelId,
        buildRecordFn(modelId, {
          name: meta.displayName || undefined,
          release_date: meta.createdAt ? meta.createdAt.split("T")[0] : undefined,
        })
      );
    }
    // Refresh timestamp for all API-confirmed models
    const existing = recordMap.get(modelId);
    if (existing) existing.data_refreshed_at = now;
  }
}

// ---------------------------------------------------------------------------
// Create sync + healthCheck via factory
// ---------------------------------------------------------------------------

const { sync, healthCheck } = createAdapterSyncer<
  Map<string, { displayName: string; createdAt: string }>
>({
  apiKeySecret: "ANTHROPIC_API_KEY",
  apiSourceName: "anthropic_api",
  knownModelIds: Object.keys(ANTHROPIC_KNOWN_MODELS),
  buildRecordFn: boundBuildRecord,
  staticModelCount: Object.keys(ANTHROPIC_KNOWN_MODELS).length,
  scrapeFn: tryScrapeDocsPage,
  apiFn: tryFetchLiveApi,
  enrichFn: enrichFromApi,
  healthCheckUrl: "https://api.anthropic.com/v1/models?limit=1",
  healthCheckHeaders: (apiKey) => ({
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  }),
  healthCheckSuccessMsg: "Anthropic /v1/models API reachable",
  deactivateMissing: {
    provider: "Anthropic",
    slugPrefix: "anthropic",
  },
});

// ---------------------------------------------------------------------------
// Adapter definition
// ---------------------------------------------------------------------------

const adapter: DataSourceAdapter = {
  id: "anthropic-models",
  name: "Anthropic Models",
  outputTypes: ["models"],
  defaultConfig: {},
  requiredSecrets: [],
  sync,
  healthCheck,
};

registerAdapter(adapter);
export default adapter;
