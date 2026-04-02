import type {
  DataSourceAdapter,
  SyncContext,
  SyncResult,
  HealthCheckResult,
} from "../types";
import { registerAdapter } from "../registry";
import { fetchWithRetry, makeSlug } from "../utils";
import {
  buildModelAliasIndex,
  fetchAllActiveAliasModels,
  resolveMatchedAliasFamilyModelIds,
} from "../model-alias-resolver";
// REMOVED: import { sanitizeFilterValue, sanitizeSlug } from "@/lib/utils/sanitize";

/**
 * Artificial Analysis Adapter — AI Model Benchmarks & Pricing
 *
 * Primary: v2 API (requires ARTIFICIAL_ANALYSIS_API_KEY — free tier, 1k req/day)
 *   GET https://artificialanalysis.ai/api/v2/data/llms/models
 *
 * Fallback: Static top model benchmark data so sync always succeeds.
 *
 * Writes to both model_news (traceability) and benchmark_scores (structured).
 */

interface AAModel {
  model_name: string;
  provider: string;
  quality_index?: number;
  speed_index?: number;
  price_per_million_tokens?: number;
  output_tokens_per_second?: number;
  time_to_first_token_ms?: number;
  context_window?: number;
  mmlu_score?: number;
  mmlu?: number;
  humaneval_score?: number;
  human_eval?: number;
  math?: number;
  math_score?: number;
  gpqa?: number;
  coding?: number;
  reasoning?: number;
  last_updated?: string;
}

// v2 API response model structure
interface AAv2Model {
  id?: string;
  name?: string;
  slug?: string;
  model_creator?: { id?: string; name?: string; slug?: string };
  evaluations?: Record<string, number | null>;
  pricing?: {
    price_1m_blended_3_to_1?: number;
    price_1m_input_tokens?: number;
    price_1m_output_tokens?: number;
  };
  median_output_tokens_per_second?: number;
  median_time_to_first_token_seconds?: number;
}

const AA_API_V2 = "https://artificialanalysis.ai/api/v2/data/llms/models";

// ────────────────────────────────────────────────────────────────
// Benchmark slug mapping
// Maps Artificial Analysis field names → our benchmark table slugs
// ────────────────────────────────────────────────────────────────

const BENCHMARK_SLUG_MAP: Record<string, string> = {
  mmlu: "mmlu",
  mmlu_score: "mmlu",
  mmlu_pro: "mmlu-pro",
  humaneval: "humaneval",
  humaneval_score: "humaneval",
  human_eval: "humaneval",
  math: "math-benchmark",
  math_score: "math-benchmark",
  math_500: "math-benchmark",
  gpqa: "gpqa",
  coding: "humaneval",
  reasoning: "gpqa",
  livecodebench: "humaneval",
};

// ────────────────────────────────────────────────────────────────
// Explicit slug overrides — makeSlug() can't produce provider-prefixed slugs.
// Maps model_name → known DB slug prefix for reliable matching.
// ────────────────────────────────────────────────────────────────

const SLUG_OVERRIDES: Record<string, string> = {
  "o3": "openai-o3",
  "o4-mini": "openai-o4-mini",
  "o3 Pro": "openai-o3-pro",
  "o1": "openai-o1",
  "o1-mini": "openai-o1-mini",
  "GPT-4o": "openai-gpt-4o",
  "GPT-4.1": "openai-gpt-4-1",
  "GPT-4.1 mini": "openai-gpt-4-1-mini",
  "GPT-4.1 nano": "openai-gpt-4-1-nano",
  "GPT-4o-mini": "openai-gpt-4o-mini",
  "GPT-4.5": "openai-gpt-4-5",
  "Claude 4 Opus": "anthropic-claude-4-opus",
  "Claude 4 Sonnet": "anthropic-claude-4-sonnet",
  "Claude Opus 4.6": "anthropic-claude-opus-4-6",
  "Claude 3.5 Sonnet": "anthropic-claude-3-5-sonnet",
  "Claude 3.5 Haiku": "anthropic-claude-3-5-haiku",
  "Gemini 2.5 Pro": "google-gemini-2-5-pro",
  "Gemini 2.5 Flash": "google-gemini-2-5-flash",
  "Gemini 2.0 Flash": "google-gemini-2-0-flash",
  "Llama 4 Maverick": "meta-llama-4-maverick",
  "Llama 4 Scout": "meta-llama-4-scout",
  "Llama 3.3 70B": "meta-llama-3-3-70b",
  "DeepSeek V3": "deepseek-v3",
  "DeepSeek R1": "deepseek-r1",
  "DeepSeek R1-0528": "deepseek-r1-0528",
  "Grok 3": "xai-grok-3",
  "Grok 3 Mini": "xai-grok-3-mini",
  "Command R+": "cohere-command-r-",
  "Qwen 2.5 72B": "alibaba-qwen2-5-72b",
  "Mistral Large": "mistralai-mistral-large",
  "Mistral Small": "mistralai-mistral-small",
};

// ────────────────────────────────────────────────────────────────
// Static fallback data — used when no API key is available.
// Sourced from publicly reported benchmarks as of early 2026.
// ────────────────────────────────────────────────────────────────

const STATIC_MODELS: AAModel[] = [
  { model_name: "GPT-4o", provider: "OpenAI", quality_index: 83, speed_index: 75, price_per_million_tokens: 5.0, mmlu_score: 88.7, gpqa: 53.6, humaneval_score: 90.2, context_window: 128000 },
  { model_name: "GPT-4.1", provider: "OpenAI", quality_index: 87, speed_index: 78, price_per_million_tokens: 2.0, mmlu_score: 90.2, gpqa: 56.1, humaneval_score: 92.0, context_window: 1048576 },
  { model_name: "GPT-4.1 mini", provider: "OpenAI", quality_index: 78, speed_index: 85, price_per_million_tokens: 0.4, mmlu_score: 85.5, gpqa: 48.0, context_window: 1048576 },
  { model_name: "GPT-4.1 nano", provider: "OpenAI", quality_index: 65, speed_index: 92, price_per_million_tokens: 0.1, mmlu_score: 78.0, context_window: 1048576 },
  { model_name: "GPT-4o-mini", provider: "OpenAI", quality_index: 72, speed_index: 90, price_per_million_tokens: 0.3, mmlu_score: 82.0, gpqa: 40.2, context_window: 128000 },
  { model_name: "GPT-4.5", provider: "OpenAI", quality_index: 86, speed_index: 60, price_per_million_tokens: 75.0, mmlu_score: 90.0, gpqa: 62.5, math: 85.6, humaneval_score: 89.0, context_window: 128000 },
  { model_name: "o3", provider: "OpenAI", quality_index: 92, speed_index: 30, price_per_million_tokens: 10.0, mmlu_score: 91.5, gpqa: 79.7, math: 96.7, humaneval_score: 92.8, context_window: 200000 },
  { model_name: "o3 Pro", provider: "OpenAI", quality_index: 93, speed_index: 15, price_per_million_tokens: 40.0, mmlu_score: 92.0, gpqa: 81.0, math: 97.0, context_window: 200000 },
  { model_name: "o4-mini", provider: "OpenAI", quality_index: 88, speed_index: 55, price_per_million_tokens: 2.2, mmlu_score: 89.0, gpqa: 72.0, math: 94.0, humaneval_score: 93.4, context_window: 200000 },
  { model_name: "o1", provider: "OpenAI", quality_index: 87, speed_index: 25, price_per_million_tokens: 15.0, mmlu_score: 91.8, gpqa: 78.0, math: 94.8, context_window: 200000 },
  { model_name: "o1-mini", provider: "OpenAI", quality_index: 78, speed_index: 50, price_per_million_tokens: 3.0, mmlu_score: 85.2, gpqa: 60.0, math: 90.0, context_window: 128000 },
  { model_name: "Claude 4 Sonnet", provider: "Anthropic", quality_index: 89, speed_index: 70, price_per_million_tokens: 3.0, mmlu_score: 90.4, gpqa: 65.0, humaneval_score: 93.0, context_window: 200000 },
  { model_name: "Claude 4 Opus", provider: "Anthropic", quality_index: 91, speed_index: 45, price_per_million_tokens: 15.0, mmlu_score: 91.0, gpqa: 68.0, math: 83.0, humaneval_score: 91.5, context_window: 200000 },
  { model_name: "Claude Opus 4.6", provider: "Anthropic", quality_index: 92, speed_index: 40, price_per_million_tokens: 15.0, mmlu_score: 91.5, gpqa: 70.0, math: 85.0, humaneval_score: 92.5, context_window: 200000 },
  { model_name: "Claude 3.5 Sonnet", provider: "Anthropic", quality_index: 85, speed_index: 72, price_per_million_tokens: 3.0, mmlu_score: 88.7, gpqa: 59.4, humaneval_score: 92.0, context_window: 200000 },
  { model_name: "Claude 3.5 Haiku", provider: "Anthropic", quality_index: 75, speed_index: 88, price_per_million_tokens: 0.8, mmlu_score: 83.5, gpqa: 41.0, context_window: 200000 },
  { model_name: "Gemini 2.5 Pro", provider: "Google", quality_index: 90, speed_index: 55, price_per_million_tokens: 1.25, mmlu_score: 90.8, gpqa: 71.4, math: 90.2, humaneval_score: 89.0, context_window: 1048576 },
  { model_name: "Gemini 2.5 Flash", provider: "Google", quality_index: 82, speed_index: 85, price_per_million_tokens: 0.15, mmlu_score: 86.5, gpqa: 59.0, math: 82.0, context_window: 1048576 },
  { model_name: "Gemini 2.0 Flash", provider: "Google", quality_index: 78, speed_index: 88, price_per_million_tokens: 0.10, mmlu_score: 84.0, gpqa: 50.0, context_window: 1048576 },
  { model_name: "Llama 4 Maverick", provider: "Meta", quality_index: 84, speed_index: 72, price_per_million_tokens: 0.5, mmlu_score: 88.0, gpqa: 55.0, math: 79.2, context_window: 1048576 },
  { model_name: "Llama 4 Scout", provider: "Meta", quality_index: 80, speed_index: 80, price_per_million_tokens: 0.3, mmlu_score: 84.5, gpqa: 49.0, context_window: 512000 },
  { model_name: "Llama 3.3 70B", provider: "Meta", quality_index: 79, speed_index: 75, price_per_million_tokens: 0.59, mmlu_score: 86.0, gpqa: 50.5, context_window: 128000 },
  { model_name: "Mistral Large", provider: "Mistral AI", quality_index: 82, speed_index: 65, price_per_million_tokens: 2.0, mmlu_score: 84.0, gpqa: 46.3, context_window: 128000 },
  { model_name: "Mistral Small", provider: "Mistral AI", quality_index: 72, speed_index: 82, price_per_million_tokens: 0.2, mmlu_score: 78.0, gpqa: 35.0, context_window: 128000 },
  { model_name: "DeepSeek V3", provider: "DeepSeek", quality_index: 85, speed_index: 70, price_per_million_tokens: 0.27, mmlu_score: 87.1, gpqa: 59.1, math: 90.2, context_window: 128000 },
  { model_name: "DeepSeek R1", provider: "DeepSeek", quality_index: 89, speed_index: 35, price_per_million_tokens: 0.55, mmlu_score: 90.8, gpqa: 71.5, math: 97.3, context_window: 128000 },
  { model_name: "DeepSeek R1-0528", provider: "DeepSeek", quality_index: 90, speed_index: 32, price_per_million_tokens: 0.55, mmlu_score: 91.0, gpqa: 73.0, math: 97.5, context_window: 128000 },
  { model_name: "Grok 3", provider: "xAI", quality_index: 87, speed_index: 60, price_per_million_tokens: 3.0, mmlu_score: 89.5, gpqa: 63.0, context_window: 131072 },
  { model_name: "Grok 3 Mini", provider: "xAI", quality_index: 80, speed_index: 78, price_per_million_tokens: 0.6, mmlu_score: 84.0, gpqa: 52.0, context_window: 131072 },
  { model_name: "Command R+", provider: "Cohere", quality_index: 70, speed_index: 65, price_per_million_tokens: 2.5, mmlu_score: 75.7, context_window: 128000 },
  { model_name: "Qwen 2.5 72B", provider: "Alibaba", quality_index: 80, speed_index: 60, price_per_million_tokens: 0.4, mmlu_score: 86.1, gpqa: 49.0, context_window: 131072 },
];

// ────────────────────────────────────────────────────────────────
// Helper — extract numeric benchmark fields from an AAModel record
// ────────────────────────────────────────────────────────────────

function extractBenchmarkValues(m: AAModel): Array<{ field: string; value: number }> {
  const results: Array<{ field: string; value: number }> = [];

  const candidates: Array<{ field: string; value: number | undefined }> = [
    { field: "mmlu_score", value: m.mmlu_score },
    { field: "mmlu", value: m.mmlu },
    { field: "humaneval_score", value: m.humaneval_score },
    { field: "human_eval", value: m.human_eval },
    { field: "math_score", value: m.math_score },
    { field: "math", value: m.math },
    { field: "gpqa", value: m.gpqa },
    { field: "coding", value: m.coding },
    { field: "reasoning", value: m.reasoning },
  ];

  for (const { field, value } of candidates) {
    if (value != null && typeof value === "number" && isFinite(value) && BENCHMARK_SLUG_MAP[field]) {
      results.push({ field, value });
    }
  }

  return results;
}

/** Convert v2 API response model to our AAModel format */
function v2ModelToAAModel(v2: AAv2Model): AAModel {
  const evals = v2.evaluations ?? {};
  return {
    model_name: v2.name ?? v2.slug ?? "unknown",
    provider: v2.model_creator?.name ?? "unknown",
    quality_index: (evals.artificial_analysis_intelligence_index as number) ?? undefined,
    mmlu_score: (evals.mmlu_pro as number) ?? undefined,
    gpqa: (evals.gpqa as number) ?? undefined,
    math: (evals.math_500 as number) ?? (evals.aime as number) ?? undefined,
    humaneval_score: (evals.livecodebench as number) ?? (evals.scicode as number) ?? undefined,
    coding: (evals.artificial_analysis_coding_index as number) ?? undefined,
    reasoning: (evals.artificial_analysis_math_index as number) ?? undefined,
    price_per_million_tokens: v2.pricing?.price_1m_blended_3_to_1 ?? undefined,
    output_tokens_per_second: v2.median_output_tokens_per_second ?? undefined,
    time_to_first_token_ms: v2.median_time_to_first_token_seconds
      ? v2.median_time_to_first_token_seconds * 1000
      : undefined,
  };
}

const adapter: DataSourceAdapter = {
  id: "artificial-analysis",
  name: "Artificial Analysis",
  outputTypes: ["benchmarks", "pricing"],
  defaultConfig: {},
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const errors: { message: string; context?: string }[] = [];
    const sb = ctx.supabase;
    let models: AAModel[] = [];
    let dataSource = "static_fallback";

    // Try v2 API if we have a key
    const apiKey = process.env.ARTIFICIAL_ANALYSIS_API_KEY;
    if (apiKey) {
      try {
        const res = await fetchWithRetry(
          AA_API_V2,
          {
            headers: {
              Accept: "application/json",
              "User-Agent": "AI-Market-Cap-Bot",
              "x-api-key": apiKey,
            },
          },
          { signal: ctx.signal }
        );

        if (res.ok) {
          const data = await res.json();
          const v2Models: AAv2Model[] = Array.isArray(data) ? data : (data.models ?? data.data ?? []);
          if (v2Models.length > 0) {
            models = v2Models.map(v2ModelToAAModel);
            dataSource = "v2_api";
          }
        } else {
          errors.push({
            message: `AA v2 API returned HTTP ${res.status} — falling back to static data`,
            context: "v2_api_fallback",
          });
        }
      } catch (err) {
        errors.push({
          message: `AA v2 API error: ${err instanceof Error ? err.message : String(err)} — falling back to static data`,
          context: "v2_api_fallback",
        });
      }
    }

    // Fallback to static data if API didn't work or no key
    if (models.length === 0) {
      models = STATIC_MODELS;
      dataSource = "static_fallback";
    }

    const recordsProcessed = models.length;
    const today = new Date().toISOString().split("T")[0];

    // ── Pre-load all models + benchmark IDs for efficient matching ──
    const modelList = await fetchAllActiveAliasModels(sb);
    const modelAliasIndex = buildModelAliasIndex(modelList);

    // Build base-slug → dated-variant-IDs map
    const baseToDatedIds = new Map<string, string[]>();
    for (const dbModel of modelList) {
      const dateMatch = dbModel.slug.match(/^(.+)-\d{4}-\d{2}-\d{2}$/);
      if (dateMatch) {
        const baseSlug = dateMatch[1];
        const existing = baseToDatedIds.get(baseSlug) ?? [];
        existing.push(dbModel.id);
        baseToDatedIds.set(baseSlug, existing);
      }
    }

    // Pre-load benchmark ID lookup
    const { data: allBenchmarks } = await sb.from("benchmarks").select("id, slug");
    const benchmarkIdMap = new Map<string, number>();
    for (const b of allBenchmarks ?? []) {
      benchmarkIdMap.set(b.slug, b.id);
    }

    /**
     * Find the primary model AND all dated variants in the DB.
     * Uses SLUG_OVERRIDES for reliable matching, then falls back to makeSlug.
     */
    function findAllMatchingModelIds(m: AAModel): string[] {
      const ids: string[] = [];
      const overrideSlug = SLUG_OVERRIDES[m.model_name];

      // Primary match: use override slug → exact match
      let primaryModel: { id: string; slug: string; name: string; provider: string } | undefined;
      if (overrideSlug) {
        primaryModel = modelList.find((db) => db.slug === overrideSlug);
      }

      // Fallback: try makeSlug with provider prefix, then name ilike
      if (!primaryModel) {
        const providerSlug = makeSlug(m.provider);
        const modelSlug = makeSlug(m.model_name);
        const fullSlug = `${providerSlug}-${modelSlug}`;
        primaryModel = modelList.find(
          (db) => db.slug === fullSlug || db.slug === modelSlug
        );
      }
      if (!primaryModel) {
        const lowerName = m.model_name.toLowerCase();
        primaryModel = modelList.find(
          (db) => db.name.toLowerCase() === lowerName
        );
      }

      if (!primaryModel) return ids;
      const relatedIds = resolveMatchedAliasFamilyModelIds(modelAliasIndex, modelList, [
        m.model_name,
        primaryModel.name,
        overrideSlug ?? null,
      ]);

      if (relatedIds.length > 0) {
        return relatedIds;
      }

      ids.push(primaryModel.id);
      const datedIds = baseToDatedIds.get(primaryModel.slug) ?? [];
      for (const did of datedIds) {
        if (!ids.includes(did)) ids.push(did);
      }

      return ids;
    }

    // Upsert benchmark data — match models by slug or name
    let recordsCreated = 0;
    for (const m of models) {
      const modelSlug = makeSlug(m.model_name);
      const matchedIds = findAllMatchingModelIds(m);

      if (matchedIds.length === 0) continue;
      const primaryId = matchedIds[0];

      // Update the primary model with benchmark + pricing data
      const updateData: Record<string, unknown> = {
        data_refreshed_at: new Date().toISOString(),
      };

      if (m.context_window) updateData.context_window = m.context_window;

      // Update all matched models (primary + dated variants)
      for (const mid of matchedIds) {
        const { error: updateError } = await sb
          .from("models")
          .update(updateData)
          .eq("id", mid);

        if (updateError) {
          errors.push({
            message: `Update model ${m.model_name} (${mid}): ${updateError.message}`,
          });
        }
      }

      // Upsert benchmark as news entry for traceability (primary only)
      const benchmarkRecord = {
        source: "artificial-analysis",
        source_id: `aa-${modelSlug}-${today}`,
        title: `${m.model_name} Benchmark Update`,
        related_model_ids: [primaryId],
        summary: [
          m.quality_index != null ? `Quality: ${m.quality_index}/100` : null,
          m.speed_index != null ? `Speed: ${m.speed_index}/100` : null,
          m.price_per_million_tokens != null ? `Price: $${m.price_per_million_tokens}/M tokens` : null,
          m.output_tokens_per_second != null ? `Output: ${m.output_tokens_per_second} tok/s` : null,
          m.mmlu_score != null ? `MMLU: ${m.mmlu_score}%` : null,
          m.humaneval_score != null ? `HumanEval: ${m.humaneval_score}%` : null,
        ]
          .filter(Boolean)
          .join(" | "),
        url: "https://artificialanalysis.ai/leaderboards/models",
        published_at: new Date().toISOString(),
        category: "benchmark",
        related_provider: m.provider || null,
        tags: ["benchmark", "pricing", "artificial-analysis"],
        metadata: {
          quality_index: m.quality_index ?? null,
          speed_index: m.speed_index ?? null,
          price_per_million_tokens: m.price_per_million_tokens ?? null,
          output_tokens_per_second: m.output_tokens_per_second ?? null,
          time_to_first_token_ms: m.time_to_first_token_ms ?? null,
          mmlu_score: m.mmlu_score ?? null,
          humaneval_score: m.humaneval_score ?? null,
          context_window: m.context_window ?? null,
          data_source: dataSource,
        },
      };

      const { error: newsError } = await sb
        .from("model_news")
        .upsert(benchmarkRecord, { onConflict: "source,source_id" });

      if (newsError) {
        errors.push({
          message: `Benchmark news for ${m.model_name}: ${newsError.message}`,
        });
      } else {
        recordsCreated++;
      }

      // ── Write structured benchmark_scores rows ──────────────────
      const benchmarkValues = extractBenchmarkValues(m);

      // Deduplicate by target slug (prefer the first occurrence)
      const seenSlugs = new Set<string>();
      for (const { field, value } of benchmarkValues) {
        const benchmarkSlug = BENCHMARK_SLUG_MAP[field];
        if (!benchmarkSlug || seenSlugs.has(benchmarkSlug)) continue;
        seenSlugs.add(benchmarkSlug);

        const benchmarkRowId = benchmarkIdMap.get(benchmarkSlug);
        if (!benchmarkRowId) continue;

        // Normalize to 0-100 if needed
        const normalizedScore = value > 1 ? value : value * 100;

        // Write score to ALL matched model IDs (primary + dated variants)
        for (const mid of matchedIds) {
          const scoreRecord = {
            model_id: mid,
            benchmark_id: benchmarkRowId,
            score: value,
            score_normalized: normalizedScore,
            model_version: "",
            source: "artificial-analysis",
            evaluation_date: new Date().toISOString().split("T")[0],
          };

          const { error: scoreError } = await sb
            .from("benchmark_scores")
            .upsert(scoreRecord, {
              onConflict: "model_id,benchmark_id,model_version",
            });

          if (scoreError) {
            errors.push({
              message: `benchmark_scores upsert for ${m.model_name}/${benchmarkSlug} (${mid}): ${scoreError.message}`,
            });
          }
        }
      }
    }

    // Filter out non-fatal fallback errors for success determination
    const fatalErrors = errors.filter((e) => !e.context?.includes("fallback"));
    return {
      success: fatalErrors.length === 0,
      recordsProcessed,
      recordsCreated,
      recordsUpdated: 0,
      errors,
      metadata: { source: dataSource, modelCount: models.length },
    };
  },

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    // Always healthy since we have static fallback
    const apiKey = process.env.ARTIFICIAL_ANALYSIS_API_KEY;
    if (apiKey) {
      try {
        const res = await fetch(AA_API_V2, {
          headers: {
            Accept: "application/json",
            "x-api-key": apiKey,
          },
        });
        if (res.ok) {
          return { healthy: true, latencyMs: Date.now() - start, message: "v2 API reachable" };
        }
        return {
          healthy: true,
          latencyMs: Date.now() - start,
          message: `v2 API returned ${res.status} — static fallback available`,
        };
      } catch {
        return {
          healthy: true,
          latencyMs: Date.now() - start,
          message: "v2 API unreachable — static fallback available",
        };
      }
    }

    return {
      healthy: true,
      latencyMs: Date.now() - start,
      message: "No API key — using static fallback data",
    };
  },
};

registerAdapter(adapter);
export default adapter;
