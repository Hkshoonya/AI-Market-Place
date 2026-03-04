/**
 * TerminalBench 2.0 Adapter — Static Agent Benchmark Data
 *
 * Curated terminal/CLI agent benchmark scores.
 * Uses fuzzyMatchModel to map model names to DB models.
 */

import type { DataSourceAdapter, SyncContext, SyncResult, SyncError } from "../types";
import { registerAdapter } from "../registry";
import { fuzzyMatchModel } from "../model-matcher";

const TERMINAL_BENCH_MODELS: Array<{ name: string; score: number }> = [
  { name: "GPT-5.3 Codex", score: 77.3 },
  { name: "Claude Opus 4.6", score: 72.1 },
  { name: "Gemini 3.1 Pro", score: 68.5 },
  { name: "Claude 4 Opus", score: 65.8 },
  { name: "GPT-4.1", score: 58.2 },
  { name: "DeepSeek-V3.2", score: 54.7 },
  { name: "Kimi K2.5", score: 51.3 },
  { name: "o3", score: 70.9 },
  { name: "o4-mini", score: 62.4 },
  { name: "Claude 4 Sonnet", score: 59.1 },
  { name: "Gemini 2.5 Pro", score: 55.8 },
  { name: "Gemini 2.5 Flash", score: 48.2 },
  { name: "GPT-4o", score: 42.6 },
  { name: "Llama 4 Maverick", score: 39.8 },
  { name: "DeepSeek R1-0528", score: 52.1 },
  { name: "Qwen 3 235B", score: 45.3 },
  { name: "Mistral Large 2", score: 38.7 },
  { name: "Grok 3", score: 44.5 },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter: DataSourceAdapter = {
  id: "terminal-bench",
  name: "TerminalBench 2.0",
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
        .eq("slug", "terminal-bench")
        .single();

      if (!benchmark) {
        return { success: false, recordsProcessed: 0, recordsCreated: 0, recordsUpdated: 0, errors: [{ message: "terminal-bench benchmark not found" }] };
      }

      const { data: models } = await supabase
        .from("models")
        .select("id, name, slug, provider")
        .eq("status", "active");

      if (!models) {
        return { success: false, recordsProcessed: 0, recordsCreated: 0, recordsUpdated: 0, errors: [{ message: "No models found" }] };
      }

      for (const entry of TERMINAL_BENCH_MODELS) {
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
              source: "terminal-bench",
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
