import type {
  DataSourceAdapter,
  SyncContext,
  SyncResult,
  HealthCheckResult,
} from "../types";
import { registerAdapter } from "../registry";
import { fetchWithRetry, makeSlug } from "../utils";
import { sanitizeFilterValue, sanitizeSlug } from "@/lib/utils/sanitize";

/**
 * Open LLM Leaderboard Adapter — HuggingFace Benchmark Rankings
 *
 * Fetches model benchmark scores from the Open LLM Leaderboard v2
 * via the HuggingFace Datasets Server API (open-llm-leaderboard/contents).
 *
 * Columns: fullname, Model, Average ⬆️, IFEval, BBH, MATH Lvl 5,
 *          GPQA, MUSR, MMLU-PRO, #Params (B), Type
 *
 * Writes to both model_news (traceability) and benchmark_scores (structured).
 */

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

const HF_DATASET = "open-llm-leaderboard/contents";
const HF_ROWS_API = "https://datasets-server.huggingface.co/rows";
const PAGE_LENGTH = 100;

// ────────────────────────────────────────────────────────────────
// Benchmark field → slug mapping
// Maps column names from the leaderboard dataset → our benchmark slugs
// ────────────────────────────────────────────────────────────────

const BENCHMARK_FIELD_MAP: Record<string, string> = {
  IFEval: "ifeval",
  BBH: "bbh",
  "MATH Lvl 5": "math-benchmark",
  GPQA: "gpqa",
  MUSR: "musr",
  "MMLU-PRO": "mmlu-pro",
};

const adapter: DataSourceAdapter = {
  id: "open-llm-leaderboard",
  name: "Open LLM Leaderboard",
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

    // Fetch all rows from HF Datasets Server API with pagination
    const allRows: HFRowContent[] = [];
    let offset = 0;
    let totalRows = Infinity;

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
            headers: {
              Accept: "application/json",
              "User-Agent": "AI-Market-Cap-Bot",
            },
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

        // Safety: if the page returned no rows, stop
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
            message: `Failed to fetch leaderboard: ${err instanceof Error ? err.message : String(err)}`,
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
        errors: [{ message: "HF Datasets API returned empty data", context: "empty_response" }],
        metadata: { source: "hf_datasets_api", dataset: HF_DATASET },
      };
    }

    // Sort by average score descending for ranking
    allRows.sort((a, b) => {
      const avgA = (a["Average ⬆️"] as number) ?? 0;
      const avgB = (b["Average ⬆️"] as number) ?? 0;
      return avgB - avgA;
    });

    // Limit to maxEntries
    const entries = allRows.slice(0, maxEntries);
    const recordsProcessed = entries.length;
    let recordsCreated = 0;

    for (let i = 0; i < entries.length; i++) {
      const row = entries[i];
      const rank = i + 1;

      // Model name — try fullname first, then Model column
      const fullname = (row["fullname"] as string) ?? (row["Model"] as string) ?? "";
      if (!fullname) continue;

      const modelSlug = makeSlug(fullname);
      const shortName = fullname.split("/").pop() ?? fullname;

      // Extract benchmark scores from the row
      const avgScore = (row["Average ⬆️"] as number) ?? null;
      const ifevalScore = (row["IFEval"] as number) ?? null;
      const bbhScore = (row["BBH"] as number) ?? null;
      const mathScore = (row["MATH Lvl 5"] as number) ?? null;
      const gpqaScore = (row["GPQA"] as number) ?? null;
      const musrScore = (row["MUSR"] as number) ?? null;
      const mmluProScore = (row["MMLU-PRO"] as number) ?? null;
      const paramsB = (row["#Params (B)"] as number) ?? null;
      const modelType = (row["Type"] as string) ?? (row["T"] as string) ?? null;

      // Try to match model in our DB
      const { data: existing } = await sb
        .from("models")
        .select("id")
        .or(`slug.eq.${sanitizeSlug(modelSlug)},name.ilike.%${sanitizeFilterValue(shortName)}%`)
        .limit(1);

      const model = existing?.[0];

      // Store as news entry for traceability
      const benchmarkRecord = {
        source: "open-llm-leaderboard",
        source_id: `ollm-${modelSlug}-${today}`,
        title: `${fullname} — Open LLM Leaderboard #${rank}`,
        related_model_ids: model?.id ? [model.id] : [],
        summary: [
          avgScore != null ? `Avg: ${avgScore.toFixed(1)}` : null,
          ifevalScore != null ? `IFEval: ${ifevalScore.toFixed(1)}` : null,
          bbhScore != null ? `BBH: ${bbhScore.toFixed(1)}` : null,
          mathScore != null ? `MATH: ${mathScore.toFixed(1)}` : null,
          gpqaScore != null ? `GPQA: ${gpqaScore.toFixed(1)}` : null,
          mmluProScore != null ? `MMLU-PRO: ${mmluProScore.toFixed(1)}` : null,
        ]
          .filter(Boolean)
          .join(" | "),
        url: "https://huggingface.co/spaces/open-llm-leaderboard/open_llm_leaderboard",
        published_at: new Date().toISOString(),
        category: "benchmark",
        related_provider: null,
        tags: ["benchmark", "open-llm-leaderboard", modelType ?? "unknown"].filter(Boolean),
        metadata: {
          rank,
          average_score: avgScore,
          ifeval_score: ifevalScore,
          bbh_score: bbhScore,
          math_score: mathScore,
          gpqa_score: gpqaScore,
          musr_score: musrScore,
          mmlu_pro_score: mmluProScore,
          parameters_b: paramsB,
          model_type: modelType,
          model_id: model?.id ?? null,
        },
      };

      const { error } = await sb
        .from("model_news")
        .upsert(benchmarkRecord, { onConflict: "source,source_id" });

      if (error) {
        errors.push({
          message: `Leaderboard entry ${fullname}: ${error.message}`,
        });
      } else {
        recordsCreated++;
      }

      // ── Write structured benchmark_scores rows ──────────────────
      if (!model?.id) continue;

      const benchmarkCandidates: Array<{ column: string; value: number | null }> = [
        { column: "IFEval", value: ifevalScore },
        { column: "BBH", value: bbhScore },
        { column: "MATH Lvl 5", value: mathScore },
        { column: "GPQA", value: gpqaScore },
        { column: "MUSR", value: musrScore },
        { column: "MMLU-PRO", value: mmluProScore },
      ];

      for (const { column, value } of benchmarkCandidates) {
        if (value == null || typeof value !== "number" || !isFinite(value)) continue;

        const benchmarkSlug = BENCHMARK_FIELD_MAP[column];
        if (!benchmarkSlug) continue;

        // Look up the benchmark row by slug
        const { data: benchmarkRows } = await sb
          .from("benchmarks")
          .select("id")
          .eq("slug", benchmarkSlug)
          .limit(1);

        const benchmarkRow = benchmarkRows?.[0];
        if (!benchmarkRow?.id) continue;

        // Normalize: if value > 1 treat as 0-100 scale already
        const normalizedScore = value > 1 ? value : value * 100;

        const scoreRecord = {
          model_id: model.id,
          benchmark_id: benchmarkRow.id,
          score: value,
          score_normalized: normalizedScore,
          model_version: "",
          source: "open-llm-leaderboard",
          evaluation_date: new Date().toISOString().split("T")[0],
        };

        const { error: scoreError } = await sb
          .from("benchmark_scores")
          .upsert(scoreRecord, {
            onConflict: "model_id,benchmark_id,model_version",
          });

        if (scoreError) {
          errors.push({
            message: `benchmark_scores upsert for ${fullname}/${benchmarkSlug}: ${scoreError.message}`,
          });
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
        topModel: entries[0]?.["fullname"] ?? null,
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
        return {
          healthy: true,
          latencyMs,
          message: "HF Datasets API reachable for Open LLM Leaderboard",
        };
      }

      return {
        healthy: false,
        latencyMs,
        message: `HF Datasets API returned HTTP ${res.status}`,
      };
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
