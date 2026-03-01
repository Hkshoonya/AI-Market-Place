/**
 * WebArena Adapter — Static Agent Benchmark Data
 *
 * Web-based agent benchmark scores.
 * Uses fuzzyMatchModel to map model names to DB models.
 */

import type { DataSourceAdapter, SyncContext, SyncResult, SyncError } from "../types";
import { registerAdapter } from "../registry";
import { fuzzyMatchModel } from "../model-matcher";

const WEBARENA_MODELS: Array<{ name: string; score: number }> = [
  { name: "Claude 4 Opus", score: 45.2 },
  { name: "GPT-4.1", score: 42.8 },
  { name: "Gemini 3.1 Pro", score: 40.1 },
  { name: "Claude Opus 4.6", score: 43.7 },
  { name: "o3", score: 38.5 },
  { name: "Claude 4 Sonnet", score: 36.2 },
  { name: "GPT-4o", score: 30.8 },
  { name: "Gemini 2.5 Pro", score: 33.5 },
  { name: "DeepSeek-V3.2", score: 25.4 },
  { name: "o4-mini", score: 35.1 },
  { name: "Grok 3", score: 28.3 },
  { name: "Llama 4 Maverick", score: 22.7 },
];

const adapter: DataSourceAdapter = {
  id: "webarena",
  name: "WebArena",
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
        .eq("slug", "webarena")
        .single();

      if (!benchmark) {
        return { success: false, recordsProcessed: 0, recordsCreated: 0, recordsUpdated: 0, errors: [{ message: "webarena benchmark not found" }] };
      }

      const { data: models } = await supabase
        .from("models")
        .select("id, name, slug, provider")
        .eq("status", "active");

      if (!models) {
        return { success: false, recordsProcessed: 0, recordsCreated: 0, recordsUpdated: 0, errors: [{ message: "No models found" }] };
      }

      for (const entry of WEBARENA_MODELS) {
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
              source: "webarena",
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
