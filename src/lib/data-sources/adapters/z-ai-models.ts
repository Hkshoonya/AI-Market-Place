import type {
  DataSourceAdapter,
  HealthCheckResult,
  SyncContext,
  SyncResult,
} from "../types";
import { registerAdapter } from "../registry";
import { fetchWithRetry, upsertBatch } from "../utils";
import { buildRecord, type ProviderDefaults } from "../shared/build-record";
import { ZAI_KNOWN_MODELS } from "../shared/known-models/zai";

const DOCS_URL = "https://docs.z.ai/guides/llm";
const SITEMAP_URL = "https://docs.z.ai/sitemap.xml";

const PROVIDER_DEFAULTS: ProviderDefaults = {
  provider: "Z.ai",
  slugPrefix: "z-ai",
  is_open_weights: false,
  license: "commercial",
  license_name: null,
};

const MODEL_PATH_PATTERN =
  /<loc>https:\/\/docs\.z\.ai\/guides\/(?:llm|vlm|image|audio)\/([^<]+)<\/loc>/gi;

function humanizeModelId(modelId: string): string {
  if (ZAI_KNOWN_MODELS[modelId]?.name) return ZAI_KNOWN_MODELS[modelId].name;

  return modelId
    .replace(/^glm-/, "GLM-")
    .replace(/ocr/i, "OCR")
    .replace(/asr/i, "ASR")
    .split("-")
    .map((part, index) => {
      if (index === 0 && part.startsWith("GLM")) return part;
      if (/^\d/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function buildModelRecord(modelId: string): Record<string, unknown> {
  return buildRecord(
    modelId,
    ZAI_KNOWN_MODELS[modelId],
    { name: humanizeModelId(modelId) },
    PROVIDER_DEFAULTS
  );
}

async function scrapeModelIds(signal?: AbortSignal): Promise<string[]> {
  const res = await fetchWithRetry(
    SITEMAP_URL,
    { headers: { "User-Agent": "AI-Market-Cap-Bot/1.0" }, signal },
    { signal, maxRetries: 1 }
  );
  if (!res.ok) return [];

  const xml = await res.text();
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = MODEL_PATH_PATTERN.exec(xml)) !== null) {
    const modelId = decodeURIComponent(match[1]).trim();
    if (!modelId || modelId === "glm-new" || modelId === "glm-phone-multilingual") continue;
    found.add(modelId);
  }

  return [...found].sort();
}

const adapter: DataSourceAdapter = {
  id: "z-ai-models",
  name: "Z.ai Models",
  outputTypes: ["models"],
  defaultConfig: {},
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const knownIds = Object.keys(ZAI_KNOWN_MODELS);
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
        sources: scrapedIds.length > 0 ? ["static_known_models", "docs_sitemap"] : ["static_known_models"],
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
        message: res.ok ? "Z.ai docs reachable" : `Z.ai docs returned HTTP ${res.status}`,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: `Z.ai docs unreachable: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

registerAdapter(adapter);
export default adapter;

export const __testables = {
  scrapeModelIds,
  buildModelRecord,
  humanizeModelId,
};
