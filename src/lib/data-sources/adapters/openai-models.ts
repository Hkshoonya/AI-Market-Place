/**
 * OpenAI Models Adapter
 *
 * Data sourcing strategy (highest to lowest priority):
 *   1. Live OpenAI API  — if OPENAI_API_KEY is present in ctx.secrets
 *   2. Public HTML scrape — https://platform.openai.com/docs/models
 *   3. Static known-models data — always available, guarantees at least one sync
 *
 * No API key is required. The static map alone is sufficient to produce a
 * complete, meaningful sync of all current OpenAI models.
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
  OPENAI_KNOWN_MODELS,
  resolveOpenAIKnownModelMeta,
} from "../shared/known-models/openai";
import { createAdapterSyncer } from "../shared/adapter-syncer";

// ---------------------------------------------------------------------------
// Provider-level defaults
// ---------------------------------------------------------------------------

const PROVIDER_DEFAULTS: ProviderDefaults = {
  provider: "OpenAI",
  slugPrefix: "openai",
  // category and modalities NOT hardcoded — inferred per model via buildRecord
  is_open_weights: false,
  license: "commercial",
  license_name: "Proprietary",
};

function parseReleaseDateFromModelId(modelId: string): string | undefined {
  const dashedMatch = modelId.match(/-(20\d{2}-\d{2}-\d{2})$/);
  if (dashedMatch) return dashedMatch[1];

  const compactMatch = modelId.match(/-(20\d{2})(\d{2})(\d{2})(?:-v\d+)?$/);
  if (!compactMatch) return undefined;

  return `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`;
}

/** Bound buildRecord — pre-fills provider defaults and known data lookup. */
function boundBuildRecord(
  modelId: string,
  overrides: Partial<KnownModelMeta> = {}
): Record<string, unknown> {
  const releaseDate = parseReleaseDateFromModelId(modelId);
  return buildRecord(
    modelId,
    resolveOpenAIKnownModelMeta(modelId),
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

interface OpenAIModelEntry {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

interface OpenAIModelsResponse {
  data: OpenAIModelEntry[];
}

const ALLOWED_OWNERS = new Set(["openai", "system"]);

// ---------------------------------------------------------------------------
// Provider-specific fetch and scrape functions
// ---------------------------------------------------------------------------

/**
 * Attempt to fetch the live model list from the OpenAI API.
 * Returns null on any failure so the caller can fall back gracefully.
 */
async function tryFetchLiveApi(
  apiKey: string,
  signal?: AbortSignal
): Promise<string[] | null> {
  try {
    const res = await fetchWithRetry(
      "https://api.openai.com/v1/models",
      { headers: { Authorization: `Bearer ${apiKey}` }, signal },
      { maxRetries: 2, signal }
    );
    if (!res.ok) return null;

    const json: OpenAIModelsResponse = await res.json();
    return (json.data ?? [])
      .filter((m) => ALLOWED_OWNERS.has(m.owned_by))
      .map((m) => m.id);
  } catch {
    return null;
  }
}

/**
 * Try to scrape the OpenAI models docs page for model IDs.
 * Returns an empty array on failure.
 */
async function tryScrapeDocsPage(signal?: AbortSignal): Promise<string[]> {
  try {
    const res = await fetchWithRetry(
      "https://platform.openai.com/docs/models",
      {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ModelIndexBot/1.0)" },
        signal,
      },
      { maxRetries: 1, signal }
    );
    if (!res.ok) return [];

    const html = await res.text();
    const modelPattern =
      /\b(gpt-[\w.-]+|o[134](?:-[\w.-]+)?|dall-e-\d|codex-[\w-]+|whisper-\d|tts-[\w-]+|text-embedding-[\w-]+|computer-use-[\w-]+)\b/g;

    const found = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = modelPattern.exec(html)) !== null) {
      found.add(match[1]);
    }

    return [...found].filter((modelId) => {
      if (/^codex-(for-oss|and-figma|ambassadors)$/.test(modelId)) {
        return false;
      }
      if (/(\.png|\.jpe?g|\.svg|\.webp)$/i.test(modelId)) {
        return false;
      }
      if (modelId === "gpt-oss") {
        return false;
      }
      return true;
    });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Enrich function — applies OpenAI API results to the record map
// ---------------------------------------------------------------------------

function enrichFromApi(
  recordMap: Map<string, Record<string, unknown>>,
  apiResult: string[],
  now: string,
  buildRecordFn: (
    modelId: string,
    overrides?: Partial<KnownModelMeta>
  ) => Record<string, unknown>
): void {
  for (const modelId of apiResult) {
    if (!recordMap.has(modelId)) {
      recordMap.set(modelId, buildRecordFn(modelId));
    }
    // Stamp models confirmed live by the API
    const existing = recordMap.get(modelId);
    if (existing) {
      existing.data_refreshed_at = now;
    }
  }
}

// ---------------------------------------------------------------------------
// Create sync + healthCheck via factory
// ---------------------------------------------------------------------------

const { sync, healthCheck } = createAdapterSyncer<string[]>({
  apiKeySecret: "OPENAI_API_KEY",
  apiSourceName: "openai_api",
  knownModelIds: Object.keys(OPENAI_KNOWN_MODELS),
  buildRecordFn: boundBuildRecord,
  staticModelCount: Object.keys(OPENAI_KNOWN_MODELS).length,
  scrapeFn: tryScrapeDocsPage,
  apiFn: tryFetchLiveApi,
  enrichFn: enrichFromApi,
  healthCheckUrl: "https://api.openai.com/v1/models",
  healthCheckHeaders: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
  healthCheckSuccessMsg: "OpenAI API reachable",
  deactivateMissing: {
    provider: "OpenAI",
    slugPrefix: "openai",
  },
});

// ---------------------------------------------------------------------------
// Adapter definition
// ---------------------------------------------------------------------------

const adapter: DataSourceAdapter = {
  id: "openai-models",
  name: "OpenAI Models",
  outputTypes: ["models"],
  defaultConfig: {},
  requiredSecrets: [],
  sync,
  healthCheck,
};

registerAdapter(adapter);
export default adapter;
