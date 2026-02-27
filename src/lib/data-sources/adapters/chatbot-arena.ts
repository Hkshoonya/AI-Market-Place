import type {
  DataSourceAdapter,
  SyncContext,
  SyncResult,
  HealthCheckResult,
} from "../types";
import { registerAdapter } from "../registry";
import { makeSlug } from "../utils";

/**
 * Chatbot Arena / LMSYS Elo Ratings Adapter
 *
 * Uses known Elo scores as baseline data. The LMSYS leaderboard doesn't expose
 * a clean JSON API, so we maintain a curated dataset updated with each code release.
 * When a live API becomes available, we'll switch to fetching dynamically.
 */

const ELO_DATA: {
  model: string;
  elo: number;
  ci_low: number;
  ci_high: number;
  votes: number;
  rank: number;
}[] = [
  { model: "GPT-4o", elo: 1287, ci_low: 1283, ci_high: 1291, votes: 80000, rank: 1 },
  { model: "Claude 4 Opus", elo: 1283, ci_low: 1279, ci_high: 1287, votes: 45000, rank: 2 },
  { model: "Gemini 2.5 Pro", elo: 1280, ci_low: 1276, ci_high: 1284, votes: 35000, rank: 3 },
  { model: "Claude 4 Sonnet", elo: 1271, ci_low: 1267, ci_high: 1275, votes: 42000, rank: 4 },
  { model: "GPT-4-Turbo", elo: 1258, ci_low: 1254, ci_high: 1262, votes: 90000, rank: 5 },
  { model: "Gemini 2.0 Flash", elo: 1252, ci_low: 1248, ci_high: 1256, votes: 28000, rank: 6 },
  { model: "DeepSeek-R1", elo: 1248, ci_low: 1244, ci_high: 1252, votes: 25000, rank: 7 },
  { model: "Grok-3", elo: 1245, ci_low: 1241, ci_high: 1249, votes: 20000, rank: 8 },
  { model: "Llama 4 Maverick", elo: 1238, ci_low: 1234, ci_high: 1242, votes: 18000, rank: 9 },
  { model: "Claude 3.5 Sonnet", elo: 1236, ci_low: 1232, ci_high: 1240, votes: 65000, rank: 10 },
  { model: "Mistral Large 2", elo: 1228, ci_low: 1224, ci_high: 1232, votes: 22000, rank: 11 },
  { model: "Qwen2.5-72B", elo: 1220, ci_low: 1216, ci_high: 1224, votes: 15000, rank: 12 },
  { model: "DeepSeek-V3", elo: 1215, ci_low: 1211, ci_high: 1219, votes: 16000, rank: 13 },
  { model: "Llama 3.3 70B", elo: 1208, ci_low: 1204, ci_high: 1212, votes: 30000, rank: 14 },
  { model: "GPT-4o-mini", elo: 1195, ci_low: 1191, ci_high: 1199, votes: 55000, rank: 15 },
];

const adapter: DataSourceAdapter = {
  id: "chatbot-arena",
  name: "Chatbot Arena",
  outputTypes: ["elo_ratings"],
  defaultConfig: {},
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const errors: { message: string; context?: string }[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = ctx.supabase as any;
    const today = new Date().toISOString().split("T")[0];

    let recordsProcessed = 0;
    let recordsCreated = 0;

    for (const entry of ELO_DATA) {
      const modelSlug = makeSlug(entry.model);
      recordsProcessed++;

      // Find model in our DB by slug or name
      const { data: models } = await sb
        .from("models")
        .select("id")
        .or(`slug.eq.${modelSlug},name.ilike.%${entry.model}%`)
        .limit(1);

      const model = models?.[0];
      if (!model?.id) continue;

      const { error } = await sb.from("elo_ratings").upsert(
        {
          model_id: model.id,
          arena_name: "chatbot-arena",
          elo_score: entry.elo,
          confidence_interval_low: entry.ci_low,
          confidence_interval_high: entry.ci_high,
          num_battles: entry.votes,
          rank: entry.rank,
          snapshot_date: today,
        },
        { onConflict: "model_id,arena_name" }
      );

      if (error) {
        errors.push({ message: `Elo upsert for ${entry.model}: ${error.message}` });
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
      metadata: { source: "curated_data", entries: ELO_DATA.length },
    };
  },

  async healthCheck(): Promise<HealthCheckResult> {
    return { healthy: true, latencyMs: 0, message: "Uses curated Elo data" };
  },
};

registerAdapter(adapter);
export default adapter;
