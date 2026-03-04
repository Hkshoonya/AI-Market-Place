/**
 * OSWorld Adapter — Static Agent Benchmark Data
 *
 * Curated OS-level agent benchmark scores.
 * Uses fuzzyMatchModel to map model names to DB models.
 */

import type { DataSourceAdapter, SyncContext, SyncResult, SyncError } from "../types";
import { registerAdapter } from "../registry";
import { fuzzyMatchModel } from "../model-matcher";

const OSWORLD_MODELS: Array<{ name: string; score: number }> = [
  { name: "Claude 4 Opus", score: 38.2 },
  { name: "GPT-4.1", score: 32.5 },
  { name: "Gemini 3.1 Pro", score: 35.8 },
  { name: "Claude Opus 4.6", score: 36.1 },
  { name: "o3", score: 29.4 },
  { name: "GPT-4o", score: 22.8 },
  { name: "Claude 4 Sonnet", score: 28.5 },
  { name: "Gemini 2.5 Pro", score: 30.2 },
  { name: "DeepSeek-V3.2", score: 18.9 },
  { name: "Llama 4 Maverick", score: 15.3 },
  { name: "Qwen 3 235B", score: 14.7 },
  { name: "Grok 3", score: 20.1 },
];

const adapter: DataSourceAdapter = {
  id: "osworld",
  name: "OSWorld",
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
        .eq("slug", "os-world")
        .single();

      if (!benchmark) {
        return { success: false, recordsProcessed: 0, recordsCreated: 0, recordsUpdated: 0, errors: [{ message: "os-world benchmark not found" }] };
      }

      const { data: models } = await supabase
        .from("models")
        .select("id, name, slug, provider")
        .eq("status", "active");

      if (!models) {
        return { success: false, recordsProcessed: 0, recordsCreated: 0, recordsUpdated: 0, errors: [{ message: "No models found" }] };
      }

      for (const entry of OSWORLD_MODELS) {
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
              source: "osworld",
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
