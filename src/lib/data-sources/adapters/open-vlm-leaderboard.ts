/**
 * Open VLM Leaderboard Adapter — Vision/Multimodal Benchmarks
 *
 * Fetches model benchmark scores from the Open VLM Leaderboard
 * (opencompass/open_vlm_leaderboard) on HuggingFace.
 *
 * Provides vision and multimodal benchmarks (MMMU, MathVista, OCRBench)
 * that fill a critical gap — multimodal/image categories currently have
 * ZERO benchmark data in our system.
 *
 * Tier: 4 (weekly sync)
 */

import type {
  DataSourceAdapter,
  SyncContext,
  SyncResult,
  HealthCheckResult,
} from "../types";
import { registerAdapter } from "../registry";
import { fetchWithRetry, makeSlug } from "../utils";
import { sanitizeFilterValue, sanitizeSlug } from "@/lib/utils/sanitize";

// --------------- HuggingFace Datasets API Types ---------------

interface HFRowContent {
  [key: string]: unknown;
}

interface HFRow {
  row_idx: number;
  row: HFRowContent;
}

interface HFRowsResponse {
  features: { feature_idx: number; name: string; type: unknown }[];
  rows: HFRow[];
  num_rows_total: number;
  num_rows_per_page: number;
  partial: boolean;
}

// --------------- Constants ---------------

const HF_DATASET = "opencompass/open_vlm_leaderboard";
const HF_ROWS_API = "https://datasets-server.huggingface.co/rows";
const PAGE_LENGTH = 100;

/**
 * Map Open VLM Leaderboard column names to our benchmark slugs.
 * The dataset columns typically include:
 *   Method/Model, MMMU, MathVista, OCRBench, MMBench, HallusionBench,
 *   AI2D, MMStar, MME, etc.
 */
const BENCHMARK_FIELD_MAP: Record<string, string> = {
  // Primary vision benchmarks (stored in our benchmarks table)
  MMMU: "mmmu",
  "MMMU_VAL": "mmmu",
  MathVista: "mathvista",
  "MathVista_MINI": "mathvista",
  OCRBench: "ocrbench",
  // Additional vision benchmarks (mapped to generic slugs)
  MMBench: "mmbench",
  "MMBench_V11": "mmbench",
  "MMBench_DEV_EN": "mmbench",
  MME: "mme",
  AI2D: "ai2d",
  MMStar: "mmstar",
  HallusionBench: "hallusionbench",
};

const adapter: DataSourceAdapter = {
  id: "open-vlm-leaderboard",
  name: "Open VLM Leaderboard",
  outputTypes: ["benchmarks"],
  defaultConfig: {
    maxEntries: 200,
  },
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const maxEntries = (ctx.config.maxEntries as number) ?? 200;
    const errors: { message: string; context?: string }[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = ctx.supabase as any;
    const today = new Date().toISOString().split("T")[0];

    // Fetch rows from HF Datasets API
    const allRows: HFRowContent[] = [];
    let offset = 0;
    let totalRows = Infinity;

    // Use HF token from env for higher rate limits
    const hfToken = process.env.HUGGINGFACE_API_TOKEN || ctx.secrets?.HUGGINGFACE_API_TOKEN || "";
    const fetchHeaders: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "AI-Market-Cap-Bot",
    };
    if (hfToken) fetchHeaders["Authorization"] = `Bearer ${hfToken}`;

    try {
      while (offset < totalRows && allRows.length < maxEntries) {
        const url = new URL(HF_ROWS_API);
        url.searchParams.set("dataset", HF_DATASET);
        url.searchParams.set("config", "default");
        url.searchParams.set("split", "train");
        url.searchParams.set("offset", String(offset));
        url.searchParams.set("length", String(PAGE_LENGTH));

        const res = await fetchWithRetry(
          url.toString(),
          {
            headers: fetchHeaders,
            signal: ctx.signal,
          },
          { signal: ctx.signal }
        );

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          return {
            success: false,
            recordsProcessed: 0,
            recordsCreated: 0,
            recordsUpdated: 0,
            errors: [
              {
                message: `HF Datasets API returned ${res.status}: ${body.slice(0, 200)}`,
                context: "api_error",
              },
            ],
            metadata: { source: "hf_datasets_api", dataset: HF_DATASET },
          };
        }

        const json: HFRowsResponse = await res.json();
        totalRows = json.num_rows_total;

        for (const row of json.rows) {
          allRows.push(row.row);
        }

        offset += PAGE_LENGTH;
        if (json.rows.length === 0) break;
      }
    } catch (err) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [
          {
            message: `Failed to fetch Open VLM Leaderboard: ${err instanceof Error ? err.message : String(err)}`,
            context: "network_error",
          },
        ],
        metadata: { source: "hf_datasets_api", dataset: HF_DATASET },
      };
    }

    if (allRows.length === 0) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ message: "Open VLM Leaderboard returned empty data", context: "empty_response" }],
        metadata: { source: "hf_datasets_api", dataset: HF_DATASET },
      };
    }

    // Detect columns
    const firstRow = allRows[0];
    const columns = Object.keys(firstRow);

    // Identify the model name column
    const modelColumn = columns.find(c =>
      /^(method|model|Model|name|fullname)/i.test(c)
    ) ?? "Method";

    // Identify score columns
    const knownBenchmarkColumns = columns.filter(c => BENCHMARK_FIELD_MAP[c] != null);

    // Sort by average of known benchmark scores
    allRows.sort((a, b) => {
      const avgA = knownBenchmarkColumns.reduce((sum, c) => sum + (Number(a[c]) || 0), 0) / Math.max(knownBenchmarkColumns.length, 1);
      const avgB = knownBenchmarkColumns.reduce((sum, c) => sum + (Number(b[c]) || 0), 0) / Math.max(knownBenchmarkColumns.length, 1);
      return avgB - avgA;
    });

    const entries = allRows.slice(0, maxEntries);
    let recordsProcessed = 0;
    let recordsCreated = 0;

    // Cache benchmark IDs
    const benchmarkIdCache = new Map<string, string | null>();

    for (let i = 0; i < entries.length; i++) {
      const row = entries[i];
      const rank = i + 1;

      const modelName = (row[modelColumn] as string) ?? "";
      if (!modelName) continue;

      recordsProcessed++;

      const modelSlug = makeSlug(modelName);
      const shortName = modelName.split("/").pop() ?? modelName;

      // Match model in our DB
      const { data: existing } = await sb
        .from("models")
        .select("id")
        .or(`slug.eq.${sanitizeSlug(modelSlug)},name.ilike.%${sanitizeFilterValue(shortName)}%`)
        .limit(1);

      const model = existing?.[0];

      // Build summary
      const summaryParts: string[] = [];
      for (const col of knownBenchmarkColumns) {
        const val = row[col] as number | null;
        if (val != null && typeof val === "number" && isFinite(val)) {
          summaryParts.push(`${col}: ${val.toFixed(1)}`);
        }
      }

      // Store as news for traceability
      const newsRecord = {
        source: "open-vlm-leaderboard",
        source_id: `vlm-${modelSlug}-${today}`,
        title: `${modelName} — Open VLM Leaderboard #${rank}`,
        related_model_ids: model?.id ? [model.id] : [],
        summary: summaryParts.join(" | "),
        url: "https://huggingface.co/spaces/opencompass/open_vlm_leaderboard",
        published_at: new Date().toISOString(),
        category: "benchmark",
        related_provider: null,
        tags: ["benchmark", "vlm", "vision", "multimodal"],
        metadata: {
          rank,
          model_id: model?.id ?? null,
          scores: Object.fromEntries(
            knownBenchmarkColumns.map(c => [c, row[c]])
          ),
        },
      };

      const { error: newsError } = await sb
        .from("model_news")
        .upsert(newsRecord, { onConflict: "source,source_id" });

      if (newsError) {
        errors.push({ message: `News upsert for ${modelName}: ${newsError.message}` });
      }

      // Write structured benchmark_scores
      if (!model?.id) continue;

      for (const col of knownBenchmarkColumns) {
        const value = row[col] as number | null;
        if (value == null || typeof value !== "number" || !isFinite(value)) continue;

        const benchmarkSlug = BENCHMARK_FIELD_MAP[col];
        if (!benchmarkSlug) continue;

        // Get benchmark ID from cache or DB
        if (!benchmarkIdCache.has(benchmarkSlug)) {
          const { data: benchmarkRows } = await sb
            .from("benchmarks")
            .select("id")
            .eq("slug", benchmarkSlug)
            .limit(1);
          benchmarkIdCache.set(benchmarkSlug, benchmarkRows?.[0]?.id ?? null);
        }

        const benchmarkId = benchmarkIdCache.get(benchmarkSlug);
        if (!benchmarkId) continue;

        // OCRBench is 0-1000 scale, normalize to 0-100
        // MMMU, MathVista are typically 0-100 already
        let normalizedScore = value;
        if (benchmarkSlug === "ocrbench" && value > 100) {
          normalizedScore = (value / 1000) * 100;
        } else if (value <= 1) {
          normalizedScore = value * 100;
        }

        const { error: scoreError } = await sb
          .from("benchmark_scores")
          .upsert(
            {
              model_id: model.id,
              benchmark_id: benchmarkId,
              score: value,
              score_normalized: normalizedScore,
              model_version: "",
              source: "open-vlm-leaderboard",
              evaluation_date: today,
            },
            { onConflict: "model_id,benchmark_id,model_version" }
          );

        if (scoreError) {
          errors.push({
            message: `benchmark_scores upsert for ${modelName}/${benchmarkSlug}: ${scoreError.message}`,
          });
        } else {
          recordsCreated++;
        }
      }
    }

    return {
      success: errors.length === 0,
      recordsProcessed,
      recordsCreated,
      recordsUpdated: 0,
      errors,
      metadata: {
        source: "hf_datasets_api",
        dataset: HF_DATASET,
        totalRowsFetched: allRows.length,
        detectedColumns: columns,
        benchmarkColumns: knownBenchmarkColumns,
      },
    };
  },

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const url = new URL(HF_ROWS_API);
      url.searchParams.set("dataset", HF_DATASET);
      url.searchParams.set("config", "default");
      url.searchParams.set("split", "train");
      url.searchParams.set("offset", "0");
      url.searchParams.set("length", "1");

      const res = await fetchWithRetry(url.toString(), {}, { maxRetries: 1 });
      const latencyMs = Date.now() - start;

      if (res.ok) {
        return { healthy: true, latencyMs, message: "HF Datasets API reachable for Open VLM Leaderboard" };
      }

      return { healthy: false, latencyMs, message: `HF Datasets API returned HTTP ${res.status}` };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: `API unreachable: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

registerAdapter(adapter);
export default adapter;
