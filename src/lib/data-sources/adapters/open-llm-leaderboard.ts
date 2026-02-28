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
 * Fetches model benchmark scores from the Open LLM Leaderboard
 * (hosted on HuggingFace Spaces).
 *
 * Primary: HF Dataset API for leaderboard data
 * No fallback — sync fails if the API is unreachable or returns empty data.
 */

interface LeaderboardEntry {
  model_name: string;
  average_score: number;
  arc_score?: number;
  hellaswag_score?: number;
  mmlu_score?: number;
  truthfulqa_score?: number;
  winogrande_score?: number;
  gsm8k_score?: number;
  ifeval_score?: number;
  bbh_score?: number;
  math_score?: number;
  gpqa_score?: number;
  musr_score?: number;
  mmlu_pro_score?: number;
  parameters_b?: number;
  type?: string; // pretrained, fine-tuned, chat, etc.
}

const HF_LEADERBOARD_API =
  "https://huggingface.co/api/datasets/open-llm-leaderboard/contents/data/latest.jsonl";

const adapter: DataSourceAdapter = {
  id: "open-llm-leaderboard",
  name: "Open LLM Leaderboard",
  outputTypes: ["benchmarks"],
  defaultConfig: {
    maxEntries: 100,
  },
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const maxEntries = (ctx.config.maxEntries as number) ?? 100;
    const errors: { message: string; context?: string }[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = ctx.supabase as any;
    const entries: LeaderboardEntry[] = [];

    // Fetch live leaderboard data from HF — no fallback
    try {
      const res = await fetchWithRetry(
        HF_LEADERBOARD_API,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "AI-Market-Cap-Bot",
          },
        },
        { signal: ctx.signal }
      );

      if (res.ok) {
        const text = await res.text();
        // JSONL format: one JSON object per line
        const lines = text
          .split("\n")
          .filter((l) => l.trim())
          .slice(0, maxEntries);

        for (const line of lines) {
          try {
            const row = JSON.parse(line);
            entries.push({
              model_name: row.model_name ?? row.fullname ?? row.model ?? "",
              average_score: row.average ?? row.Average ?? 0,
              ifeval_score: row["IFEval"] ?? row.ifeval ?? undefined,
              bbh_score: row["BBH"] ?? row.bbh ?? undefined,
              math_score: row["MATH Lvl 5"] ?? row.math ?? undefined,
              gpqa_score: row["GPQA"] ?? row.gpqa ?? undefined,
              musr_score: row["MUSR"] ?? row.musr ?? undefined,
              mmlu_pro_score: row["MMLU-PRO"] ?? row.mmlu_pro ?? undefined,
              mmlu_score: row["MMLU"] ?? row.mmlu ?? undefined,
              arc_score: row["ARC"] ?? row.arc ?? undefined,
              hellaswag_score: row["HellaSwag"] ?? row.hellaswag ?? undefined,
              truthfulqa_score: row["TruthfulQA"] ?? row.truthfulqa ?? undefined,
              winogrande_score: row["Winogrande"] ?? row.winogrande ?? undefined,
              gsm8k_score: row["GSM8K"] ?? row.gsm8k ?? undefined,
              parameters_b: row.params_b ?? row["#Params (B)"] ?? undefined,
              type: row.Type ?? row.type ?? undefined,
            });
          } catch {
            // Skip malformed lines
          }
        }
      } else {
        return {
          success: false,
          recordsProcessed: 0,
          recordsCreated: 0,
          recordsUpdated: 0,
          errors: [{ message: `HuggingFace Leaderboard API returned HTTP ${res.status}`, context: "api_error" }],
          metadata: { source: "hf_dataset_api" },
        };
      }
    } catch (err) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ message: `HuggingFace Leaderboard API unreachable: ${err instanceof Error ? err.message : "unknown error"}`, context: "network_error" }],
        metadata: { source: "hf_dataset_api" },
      };
    }

    if (entries.length === 0) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ message: "HuggingFace Leaderboard API returned empty data", context: "empty_response" }],
        metadata: { source: "hf_dataset_api" },
      };
    }

    const recordsProcessed = entries.length;
    const today = new Date().toISOString().split("T")[0];
    let recordsCreated = 0;

    // Sort by average score descending for ranking
    entries.sort((a, b) => (b.average_score ?? 0) - (a.average_score ?? 0));

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry.model_name) continue;

      const modelSlug = makeSlug(entry.model_name);
      const rank = i + 1;

      // Try to match model in our DB
      const shortName = entry.model_name.split("/").pop() ?? entry.model_name;
      const { data: existing } = await sb
        .from("models")
        .select("id")
        .or(`slug.eq.${sanitizeSlug(modelSlug)},name.ilike.%${sanitizeFilterValue(shortName)}%`)
        .limit(1);

      const model = existing?.[0];

      // Store benchmark as news entry for traceability
      const benchmarkRecord = {
        source: "open-llm-leaderboard",
        source_id: `ollm-${modelSlug}-${today}`,
        title: `${entry.model_name} — Open LLM Leaderboard #${rank}`,
        summary: [
          `Avg: ${entry.average_score?.toFixed(1) ?? "N/A"}`,
          entry.ifeval_score != null ? `IFEval: ${entry.ifeval_score.toFixed(1)}` : null,
          entry.bbh_score != null ? `BBH: ${entry.bbh_score.toFixed(1)}` : null,
          entry.math_score != null ? `MATH: ${entry.math_score.toFixed(1)}` : null,
          entry.gpqa_score != null ? `GPQA: ${entry.gpqa_score.toFixed(1)}` : null,
          entry.mmlu_pro_score != null ? `MMLU-PRO: ${entry.mmlu_pro_score.toFixed(1)}` : null,
        ]
          .filter(Boolean)
          .join(" | "),
        url: "https://huggingface.co/spaces/open-llm-leaderboard/open_llm_leaderboard",
        published_at: new Date().toISOString(),
        category: "benchmark",
        related_provider: model ? null : null, // Provider detected from model match
        tags: ["benchmark", "open-llm-leaderboard", entry.type ?? "unknown"].filter(Boolean),
        metadata: {
          rank,
          average_score: entry.average_score ?? null,
          ifeval_score: entry.ifeval_score ?? null,
          bbh_score: entry.bbh_score ?? null,
          math_score: entry.math_score ?? null,
          gpqa_score: entry.gpqa_score ?? null,
          musr_score: entry.musr_score ?? null,
          mmlu_pro_score: entry.mmlu_pro_score ?? null,
          mmlu_score: entry.mmlu_score ?? null,
          arc_score: entry.arc_score ?? null,
          hellaswag_score: entry.hellaswag_score ?? null,
          truthfulqa_score: entry.truthfulqa_score ?? null,
          winogrande_score: entry.winogrande_score ?? null,
          gsm8k_score: entry.gsm8k_score ?? null,
          parameters_b: entry.parameters_b ?? null,
          model_type: entry.type ?? null,
          model_id: model?.id ?? null,
        },
      };

      const { error } = await sb
        .from("model_news")
        .upsert(benchmarkRecord, { onConflict: "source,source_id" });

      if (error) {
        errors.push({
          message: `Leaderboard entry ${entry.model_name}: ${error.message}`,
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
      metadata: {
        source: "hf_dataset_api",
        topModel: entries[0]?.model_name ?? null,
      },
    };
  },

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const res = await fetch(HF_LEADERBOARD_API, {
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
