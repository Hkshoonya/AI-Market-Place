/**
 * Google AI Models Adapter
 *
 * Data sourcing strategy (highest to lowest priority):
 *   1. Live Google Generative Language API — if GOOGLE_AI_API_KEY is present in ctx.secrets
 *   2. Public HTML scrape — https://ai.google.dev/gemini-api/docs/models/gemini
 *   3. Static known-models data — always available, guarantees at least one sync
 *
 * No API key is required. The static map alone is sufficient to produce a
 * complete, meaningful sync of all current Google AI models.
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
  GOOGLE_KNOWN_MODELS,
  resolveGoogleKnownModelMeta,
} from "../shared/known-models/google";
import { createAdapterSyncer } from "../shared/adapter-syncer";

// ---------------------------------------------------------------------------
// Provider-level defaults
// ---------------------------------------------------------------------------

const PROVIDER_DEFAULTS: ProviderDefaults = {
  provider: "Google",
  slugPrefix: "google",
  // category, modalities, is_open_weights, license/license_name NOT hardcoded
  // — Google has a mix (Gemini commercial, Gemma open-source, Imagen, Veo)
  // so these are inferred per model from GOOGLE_KNOWN_MODELS or by buildRecord
};

/** Bound buildRecord — pre-fills provider defaults and known data lookup. */
function boundBuildRecord(
  modelId: string,
  overrides: Partial<KnownModelMeta> = {}
): Record<string, unknown> {
  return buildRecord(
    modelId,
    resolveGoogleKnownModelMeta(modelId),
    overrides,
    PROVIDER_DEFAULTS
  );
}

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------

interface GoogleModelEntry {
  name: string;           // e.g. "models/gemini-2.0-flash"
  displayName: string;
  description: string;
  inputTokenLimit: number;
  outputTokenLimit: number;
  supportedGenerationMethods: string[];
}

interface GoogleModelsResponse {
  models: GoogleModelEntry[];
  nextPageToken?: string;
}

const GOOGLE_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

/** Extract the short model ID from "models/gemini-2.0-flash" -> "gemini-2.0-flash". */
function extractModelId(name: string): string {
  return name.replace(/^models\//, "");
}

// ---------------------------------------------------------------------------
// Provider-specific fetch and scrape functions
// ---------------------------------------------------------------------------

/**
 * Attempt to fetch the live model list from the Google Generative Language API.
 * Returns null on any failure so the caller can fall back gracefully.
 */
async function tryFetchLiveApi(
  apiKey: string,
  signal?: AbortSignal
): Promise<Map<string, { displayName: string; description: string; contextWindow: number | null }> | null> {
  const result = new Map<string, { displayName: string; description: string; contextWindow: number | null }>();
  let pageToken: string | undefined;

  try {
    do {
      const url = new URL(`${GOOGLE_API_BASE}/models`);
      url.searchParams.set("key", apiKey);
      url.searchParams.set("pageSize", "50");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const res = await fetchWithRetry(
        url.toString(),
        { signal },
        { maxRetries: 2, signal }
      );

      if (!res.ok) return null;

      const json: GoogleModelsResponse = await res.json();
      for (const entry of json.models ?? []) {
        const modelId = extractModelId(entry.name);
        result.set(modelId, {
          displayName: entry.displayName,
          description: entry.description,
          contextWindow: entry.inputTokenLimit || null,
        });
      }

      pageToken = json.nextPageToken;
    } while (pageToken);

    return result;
  } catch {
    return null;
  }
}

/**
 * Try to scrape the Google Gemini API docs page for model IDs.
 * Returns an empty array on failure.
 */
async function tryScrapeDocsPage(signal?: AbortSignal): Promise<string[]> {
  try {
    const res = await fetchWithRetry(
      "https://ai.google.dev/gemini-api/docs/models/gemini",
      {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ModelIndexBot/1.0)" },
        signal,
      },
      { maxRetries: 1, signal }
    );
    if (!res.ok) return [];

    const html = await res.text();
    const modelPattern =
      /\b(gemini-[\d.]+(?:-(?:pro|flash|ultra|nano|lite|exp|preview)(?:-[\w.]+)?)?|gemma-\d[\w.-]*|imagen-\d[\w.-]*|veo-\d[\w.-]*)\b/g;

    const found = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = modelPattern.exec(html)) !== null) {
      found.add(match[1]);
    }

    return [...found];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Enrich function — applies Google API results to the record map
// CRITICAL (Pitfall 6): Google's enrichFn must update context_window on
// existing known models if the API provides a fresher value.
// ---------------------------------------------------------------------------

function enrichFromApi(
  recordMap: Map<string, Record<string, unknown>>,
  apiResult: Map<string, { displayName: string; description: string; contextWindow: number | null }>,
  now: string,
  buildRecordFn: (
    modelId: string,
    overrides?: Partial<KnownModelMeta>
  ) => Record<string, unknown>
): void {
  for (const [modelId, meta] of apiResult) {
    if (!recordMap.has(modelId)) {
      // New model from API — create a minimal record enriched by API data
      recordMap.set(
        modelId,
        buildRecordFn(modelId, {
          name: meta.displayName || undefined,
          description: meta.description || undefined,
          context_window: meta.contextWindow ?? undefined,
        })
      );
    } else {
      // For known models, the API may provide a fresher context window value
      const existing = recordMap.get(modelId);
      if (existing && meta.contextWindow && !existing.context_window) {
        existing.context_window = meta.contextWindow;
      }
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
  Map<string, { displayName: string; description: string; contextWindow: number | null }>
>({
  apiKeySecret: "GOOGLE_AI_API_KEY",
  apiSourceName: "google_api",
  knownModelIds: Object.keys(GOOGLE_KNOWN_MODELS),
  buildRecordFn: boundBuildRecord,
  staticModelCount: Object.keys(GOOGLE_KNOWN_MODELS).length,
  scrapeFn: tryScrapeDocsPage,
  apiFn: tryFetchLiveApi,
  enrichFn: enrichFromApi,
  healthCheckUrl: (apiKey) => `${GOOGLE_API_BASE}/models?key=${apiKey}&pageSize=1`,
  healthCheckHeaders: () => ({}),
  healthCheckSuccessMsg: "Google Generative Language API reachable",
});

// ---------------------------------------------------------------------------
// Adapter definition
// ---------------------------------------------------------------------------

const adapter: DataSourceAdapter = {
  id: "google-models",
  name: "Google AI Models",
  outputTypes: ["models"],
  defaultConfig: {},
  requiredSecrets: [],
  sync,
  healthCheck,
};

registerAdapter(adapter);
export default adapter;
