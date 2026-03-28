import type {
  DataSourceAdapter,
  HealthCheckResult,
  SyncContext,
  SyncResult,
} from "../types";
import { registerAdapter } from "../registry";
import { fetchWithRetry, upsertBatch } from "../utils";
import { buildRecord, type ProviderDefaults } from "../shared/build-record";
import { MINIMAX_KNOWN_MODELS } from "../shared/known-models/minimax";

const DOCS_URL = "https://platform.minimax.io/docs";
const MODEL_PATTERN = /\b(MiniMax-[A-Za-z0-9.-]+)\b/g;

const PROVIDER_DEFAULTS: ProviderDefaults = {
  provider: "MiniMax",
  slugPrefix: "minimax",
  is_open_weights: false,
  license: "commercial",
  license_name: null,
};

function buildModelRecord(modelId: string): Record<string, unknown> {
  return buildRecord(
    modelId,
    MINIMAX_KNOWN_MODELS[modelId],
    { name: MINIMAX_KNOWN_MODELS[modelId]?.name ?? modelId.replace(/-/g, " ") },
    PROVIDER_DEFAULTS
  );
}

async function scrapeModelIds(signal?: AbortSignal): Promise<string[]> {
  const res = await fetchWithRetry(
    DOCS_URL,
    { headers: { "User-Agent": "AI-Market-Cap-Bot/1.0" }, signal },
    { signal, maxRetries: 1 }
  );
  if (!res.ok) return [];

  const html = await res.text();
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = MODEL_PATTERN.exec(html)) !== null) {
    const modelId = match[1].trim();
    if (modelId === "MiniMax-AI") continue;
    found.add(modelId);
  }
  return [...found].sort();
}

const adapter: DataSourceAdapter = {
  id: "minimax-models",
  name: "MiniMax Models",
  outputTypes: ["models"],
  defaultConfig: {},
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const knownIds = Object.keys(MINIMAX_KNOWN_MODELS);
    const scrapedIds = await scrapeModelIds(ctx.signal);
    const allIds = Array.from(new Set([...knownIds, ...scrapedIds]));
    const records = allIds.map((modelId) => buildModelRecord(modelId));
    const { created, errors } = await upsertBatch(ctx.supabase, "models", records, "slug");

    return {
      success: errors.length === 0,
      recordsProcessed: records.length,
      recordsCreated: created,
      recordsUpdated: records.length - created,
      errors,
      metadata: {
        sources: scrapedIds.length > 0 ? ["static_known_models", "docs_scrape"] : ["static_known_models"],
        scrapedIds: scrapedIds.length,
      },
    };
  },

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const res = await fetchWithRetry(
        DOCS_URL,
        { headers: { "User-Agent": "AI-Market-Cap-Bot/1.0" } },
        { maxRetries: 1 }
      );
      return {
        healthy: res.ok,
        latencyMs: Date.now() - start,
        message: res.ok ? "MiniMax docs reachable" : `MiniMax docs returned HTTP ${res.status}`,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: `MiniMax docs unreachable: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

registerAdapter(adapter);
export default adapter;

export const __testables = {
  scrapeModelIds,
  buildModelRecord,
};
