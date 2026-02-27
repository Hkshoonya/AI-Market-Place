import type {
  DataSourceAdapter,
  SyncContext,
  SyncResult,
  HealthCheckResult,
} from "../types";
import { registerAdapter } from "../registry";
import { fetchWithRetry, makeSlug, upsertBatch } from "../utils";

/**
 * Artificial Analysis Adapter — AI Model Benchmarks & Pricing
 *
 * Fetches benchmark scores (quality, speed, pricing) from the
 * Artificial Analysis public leaderboard API.
 *
 * Primary: GET https://artificialanalysis.ai/api/leaderboard
 * No fallback — sync fails if the API is unreachable or returns empty data.
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
  humaneval_score?: number;
  last_updated?: string;
}

const AA_API = "https://artificialanalysis.ai/api/leaderboard";

const adapter: DataSourceAdapter = {
  id: "artificial-analysis",
  name: "Artificial Analysis",
  outputTypes: ["benchmarks", "pricing"],
  defaultConfig: {},
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const errors: { message: string; context?: string }[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = ctx.supabase as any;
    let models: AAModel[] = [];

    // Fetch live API data — no fallback
    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
        "User-Agent": "AI-Market-Cap-Bot",
      };

      const res = await fetchWithRetry(AA_API, { headers }, { signal: ctx.signal });

      if (res.ok) {
        const data = await res.json();
        // API may return { models: [...] } or [...] directly
        models = Array.isArray(data) ? data : (data.models ?? data.data ?? []);
      } else {
        return {
          success: false,
          recordsProcessed: 0,
          recordsCreated: 0,
          recordsUpdated: 0,
          errors: [{ message: `Artificial Analysis API returned HTTP ${res.status}`, context: "api_error" }],
          metadata: { source: "live_api" },
        };
      }
    } catch (err) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ message: `Artificial Analysis API unreachable: ${err instanceof Error ? err.message : "unknown error"}`, context: "network_error" }],
        metadata: { source: "live_api" },
      };
    }

    if (models.length === 0) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ message: "Artificial Analysis API returned empty data", context: "empty_response" }],
        metadata: { source: "live_api" },
      };
    }

    const recordsProcessed = models.length;
    const today = new Date().toISOString().split("T")[0];

    // Upsert benchmark data — match models by slug or name
    let recordsCreated = 0;
    for (const m of models) {
      const modelSlug = makeSlug(m.model_name);

      // Find matching model in our DB
      const { data: existing } = await sb
        .from("models")
        .select("id, slug")
        .or(`slug.eq.${modelSlug},name.ilike.%${m.model_name}%`)
        .limit(1);

      const model = existing?.[0];
      if (!model?.id) continue;

      // Update the model with benchmark + pricing data
      const updateData: Record<string, unknown> = {
        data_refreshed_at: new Date().toISOString(),
      };

      if (m.context_window) updateData.context_window = m.context_window;

      const { error: updateError } = await sb
        .from("models")
        .update(updateData)
        .eq("id", model.id);

      if (updateError) {
        errors.push({
          message: `Update model ${m.model_name}: ${updateError.message}`,
        });
        continue;
      }

      // Upsert benchmark scores into a benchmarks-like structure via model_news
      // Store as a "benchmark_update" news entry for traceability
      const benchmarkRecord = {
        source: "artificial-analysis",
        source_id: `aa-${modelSlug}-${today}`,
        title: `${m.model_name} Benchmark Update`,
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
    }

    return {
      success: errors.length === 0,
      recordsProcessed,
      recordsCreated,
      recordsUpdated: 0,
      errors,
      metadata: { source: "live_api" },
    };
  },

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const res = await fetch(AA_API, {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        return { healthy: true, latencyMs: Date.now() - start };
      }
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: `API returned ${res.status}`,
      };
    } catch {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: "API unreachable",
      };
    }
  },
};

registerAdapter(adapter);
export default adapter;
