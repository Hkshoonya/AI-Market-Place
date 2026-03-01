/**
 * GAIA Benchmark Adapter — Static Agent Benchmark Data
 *
 * General AI Assistants benchmark scores.
 * Uses fuzzyMatchModel to map model names to DB models.
 */

import type { DataSourceAdapter, SyncContext, SyncResult, SyncError } from "../types";
import { registerAdapter } from "../registry";
import { fuzzyMatchModel } from "../model-matcher";

const GAIA_MODELS: Array<{ name: string; score: number }> = [
  { name: "o3", score: 78.2 },
  { name: "Claude Opus 4.6", score: 71.5 },
  { name: "GPT-4.1", score: 65.3 },
  { name: "Gemini 3.1 Pro", score: 62.8 },
  { name: "Claude 4 Opus", score: 68.9 },
  { name: "Claude 4 Sonnet", score: 58.4 },
  { name: "DeepSeek R1-0528", score: 55.7 },
  { name: "GPT-4o", score: 49.8 },
  { name: "Gemini 2.5 Pro", score: 54.2 },
  { name: "o4-mini", score: 61.3 },
  { name: "Llama 4 Maverick", score: 42.1 },
  { name: "Grok 3", score: 47.5 },
  { name: "Mistral Large 2", score: 39.6 },
  { name: "Qwen 3 235B", score: 44.8 },
];

const adapter: DataSourceAdapter = {
  id: "gaia-benchmark",
  name: "GAIA Benchmark",
  outputTypes: ["benchmarks"],
  defaultConfig: {},
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = ctx.supabase as any;
    let recordsProcessed = 0;
    let recordsCreated = 0;
    const recordsUpdated = 0;
    const errors: SyncError[] = [];

    try {
      const { data: benchmark } = await supabase
        .from("benchmarks")
        .select("id")
        .eq("slug", "gaia")
        .single();

      if (!benchmark) {
        return { success: false, recordsProcessed: 0, recordsCreated: 0, recordsUpdated: 0, errors: [{ message: "gaia benchmark not found" }] };
      }

      const { data: models } = await supabase
        .from("models")
        .select("id, name, slug, provider")
        .eq("status", "active");

      if (!models) {
        return { success: false, recordsProcessed: 0, recordsCreated: 0, recordsUpdated: 0, errors: [{ message: "No models found" }] };
      }

      for (const entry of GAIA_MODELS) {
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
              source: "gaia-benchmark",
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
