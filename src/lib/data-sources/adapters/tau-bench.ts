/**
 * TAU-Bench Adapter — Static Agent Benchmark Data
 *
 * Tool-Augmented Understanding benchmark scores.
 * Uses fuzzyMatchModel to map model names to DB models.
 */

import type { DataSourceAdapter, SyncContext, SyncResult, SyncError } from "../types";
import { registerAdapter } from "../registry";
import { fuzzyMatchModel } from "../model-matcher";

const TAU_BENCH_MODELS: Array<{ name: string; score: number }> = [
  { name: "o3", score: 82.5 },
  { name: "Claude Opus 4.6", score: 76.3 },
  { name: "GPT-4.1", score: 71.8 },
  { name: "Claude 4 Opus", score: 74.1 },
  { name: "Gemini 3.1 Pro", score: 68.7 },
  { name: "o4-mini", score: 66.2 },
  { name: "Claude 4 Sonnet", score: 63.5 },
  { name: "GPT-4o", score: 55.8 },
  { name: "DeepSeek R1-0528", score: 60.4 },
  { name: "Gemini 2.5 Pro", score: 58.9 },
  { name: "Grok 3", score: 52.3 },
  { name: "Llama 4 Maverick", score: 45.7 },
  { name: "Qwen 3 235B", score: 48.1 },
  { name: "Mistral Large 2", score: 43.2 },
];

const adapter: DataSourceAdapter = {
  id: "tau-bench",
  name: "TAU-Bench",
  outputTypes: ["benchmarks"],
  defaultConfig: {},
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const supabase = ctx.supabase;
    let recordsProcessed = 0;
    let recordsCreated = 0;
    const recordsUpdated = 0;
    const errors: SyncError[] = [];

    try {
      const { data: benchmark } = await supabase
        .from("benchmarks")
        .select("id")
        .eq("slug", "tau-bench")
        .single();

      if (!benchmark) {
        return { success: false, recordsProcessed: 0, recordsCreated: 0, recordsUpdated: 0, errors: [{ message: "tau-bench benchmark not found" }] };
      }

      const { data: models } = await supabase
        .from("models")
        .select("id, name, slug, provider")
        .eq("status", "active");

      if (!models) {
        return { success: false, recordsProcessed: 0, recordsCreated: 0, recordsUpdated: 0, errors: [{ message: "No models found" }] };
      }

      for (const entry of TAU_BENCH_MODELS) {
        recordsProcessed++;
        const match = fuzzyMatchModel(entry.name, models);
        if (!match) {
          errors.push({ message: `No match for: ${entry.name}` });
          continue;
        }

        const { error } = await supabase
          .from("benchmark_scores")
          .upsert(
            {
              model_id: match.id,
              benchmark_id: benchmark.id,
              score: entry.score,
              score_normalized: entry.score,
              source: "tau-bench",
              evaluation_date: new Date().toISOString().split("T")[0],
            },
            { onConflict: "model_id,benchmark_id" }
          );

        if (error) {
          errors.push({ message: `Error upserting ${entry.name}: ${error.message}` });
        } else {
          recordsCreated++;
        }
      }

      return { success: true, recordsProcessed, recordsCreated, recordsUpdated, errors };
    } catch (e) {
      return { success: false, recordsProcessed, recordsCreated, recordsUpdated, errors: [{ message: String(e) }] };
    }
  },

  async healthCheck() {
    return { healthy: true, latencyMs: 0, message: "Static data source" };
  },
};

registerAdapter(adapter);
export default adapter;
