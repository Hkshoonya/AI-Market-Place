/**
 * Official Arena text leaderboard. Never replace publication dates with sync time,
 * mix category-specific rows, or fall back to the frozen 2025 third-party mirror.
 */
import type { DataSourceAdapter, SyncContext, SyncResult, HealthCheckResult } from "../types";
import { buildModelAliasIndex, fetchAllActiveAliasModels, resolveAliasFamilyModelIds } from "../model-alias-resolver";
import { registerAdapter } from "../registry";
import { fetchWithRetry, makeSlug } from "../utils";

const HF_DATASET = "lmarena-ai/leaderboard-dataset";
const FILTER_API = "https://datasets-server.huggingface.co/filter";
const PAGE_LENGTH = 100;
const MAX_ROWS = 5000;
export const OFFICIAL_TEXT_ARENA = "arena-text-official";

export function arenaDatasetUrl(offset = 0, length = PAGE_LENGTH) {
  const url = new URL(FILTER_API);
  for (const [key, value] of Object.entries({
    dataset: HF_DATASET, config: "text", split: "latest",
    where: "\"category\" = 'overall'",
    offset: String(offset), length: String(length),
  })) url.searchParams.set(key, value);
  return url.toString();
}

export function parseOfficialArenaRow(value: unknown, now = Date.now()) {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (row.category !== "overall" || typeof row.model_name !== "string" || !row.model_name.trim()
    || typeof row.rating !== "number" || !Number.isFinite(row.rating) || row.rating <= 0 || row.rating > 3000
    || typeof row.leaderboard_publish_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.leaderboard_publish_date)) return null;
  const date = Date.parse(row.leaderboard_publish_date);
  if (!Number.isFinite(date) || date > now || now - date > 45 * 86400000) return null;
  const optionalInteger = (value: unknown, rounding = Math.round) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 ? rounding(value) : null;
  return {
    modelName: row.model_name.trim(),
    snapshotDate: row.leaderboard_publish_date,
    eloScore: Math.round(row.rating),
    confidenceLow: optionalInteger(row.rating_lower, Math.floor),
    confidenceHigh: optionalInteger(row.rating_upper, Math.ceil),
    votes: optionalInteger(row.vote_count),
    rank: optionalInteger(row.rank),
  };
}

async function fetchLeaderboardPage(offset: number, ctx?: SyncContext, length = PAGE_LENGTH, healthCheck = false) {
  const token = ctx?.secrets.HUGGINGFACE_API_TOKEN || process.env.HUGGINGFACE_API_TOKEN;
  const timeout = AbortSignal.timeout(healthCheck ? 4000 : 15_000);
  const signal = ctx?.signal ? AbortSignal.any([ctx.signal, timeout]) : timeout;
  const response = await fetchWithRetry(arenaDatasetUrl(offset, length), {
    headers: { Accept: "application/json", "User-Agent": "AI-Market-Cap-Bot", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    signal, redirect: "error",
  }, { signal, maxRetries: healthCheck ? 0 : 2, baseDelayMs: 1000 });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Official Arena dataset returned HTTP ${response.status}`);
  }
  const json = await response.json() as { rows?: Array<{ row?: unknown }>; num_rows_total?: number };
  if (!Array.isArray(json.rows) || !Number.isInteger(json.num_rows_total)
    || json.num_rows_total! <= 0 || json.num_rows_total! > MAX_ROWS) {
    throw new Error("Official Arena dataset returned an invalid or unexpectedly large result");
  }
  return { rows: json.rows, total: json.num_rows_total! };
}

const adapter: DataSourceAdapter = {
  id: "chatbot-arena",
  name: "Chatbot Arena",
  outputTypes: ["elo_ratings"],
  defaultConfig: {},
  requiredSecrets: [],

  async sync(ctx): Promise<SyncResult> {
    const errors: Array<{ message: string }> = [];
    let recordsProcessed = 0;
    let recordsCreated = 0;
    try {
      const rows: NonNullable<ReturnType<typeof parseOfficialArenaRow>>[] = [];
      for (let offset = 0, total = MAX_ROWS; offset < total; offset += PAGE_LENGTH) {
        const page = await fetchLeaderboardPage(offset, ctx);
        total = page.total;
        if (page.rows.length === 0) throw new Error("Official Arena pagination ended before the declared total");
        for (const { row } of page.rows) {
          const parsed = parseOfficialArenaRow(row);
          if (parsed) rows.push(parsed);
        }
      }
      if (!rows.length) throw new Error("No fresh, valid overall text ratings found in the official Arena dataset");
      const models = await fetchAllActiveAliasModels(ctx.supabase);
      const index = buildModelAliasIndex(models);
      let unmatchedRows = 0;
      const unmatchedModels: string[] = [];
      const pending = new Map<string, {
        model_id: string; arena_name: string; elo_score: number;
        confidence_interval_low: number | null; confidence_interval_high: number | null;
        num_battles: number | null; rank: number | null; snapshot_date: string;
      }>();
      for (const row of rows) {
        recordsProcessed++;
        const ids = resolveAliasFamilyModelIds(index, {
          slugCandidates: [makeSlug(row.modelName)], nameCandidates: [row.modelName],
          allowLooseMatch: false, expandDatedVariants: false,
        });
        if (!ids.length) {
          unmatchedRows++;
          if (unmatchedModels.length < 20) unmatchedModels.push(row.modelName.slice(0, 200));
        }
        for (const modelId of ids) {
          const rating = {
            model_id: modelId, arena_name: OFFICIAL_TEXT_ARENA,
            elo_score: row.eloScore, confidence_interval_low: row.confidenceLow,
            confidence_interval_high: row.confidenceHigh, num_battles: row.votes,
            rank: row.rank, snapshot_date: row.snapshotDate,
          };
          const key = `${modelId}:${row.snapshotDate}`;
          const previous = pending.get(key);
          if (!previous || rating.elo_score < previous.elo_score) pending.set(key, rating);
        }
      }
      const ratings = [...pending.values()];
      for (let offset = 0; offset < ratings.length; offset += 100) {
        const batch = ratings.slice(offset, offset + 100);
        const { error } = await ctx.supabase.from("elo_ratings").upsert(batch,
          { onConflict: "model_id,arena_name,snapshot_date" });
        if (error) errors.push({ message: "Could not save a batch of official Arena ratings" });
        else recordsCreated += batch.length;
      }
      if (!recordsCreated) errors.push({ message: "No official Arena rows matched exact catalog identities" });
      return { success: !errors.length, recordsProcessed, recordsCreated, recordsUpdated: 0, errors,
        metadata: { source: "official_arena_dataset", dataset: HF_DATASET,
          latestPublicationDate: rows.map((row) => row.snapshotDate).sort().at(-1),
          validOverallRows: rows.length, unmatchedRows, unmatchedModels, legacyMirrorUsed: false } };
    } catch {
      return { success: false, recordsProcessed, recordsCreated, recordsUpdated: 0,
        errors: [...errors, { message: "Official Arena sync failed; legacy mirror fallback is disabled" }] };
    }
  },

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const page = await fetchLeaderboardPage(0, undefined, 1, true);
      const valid = parseOfficialArenaRow(page.rows[0]?.row) != null;
      return { healthy: valid, latencyMs: Date.now() - start,
        message: valid ? "Official overall text ratings reachable with a recent publication date" : "Official Arena data is stale or malformed" };
    } catch {
      return { healthy: false, latencyMs: Date.now() - start, message: "Official Arena dataset unavailable" };
    }
  },
};

registerAdapter(adapter);
export default adapter;
