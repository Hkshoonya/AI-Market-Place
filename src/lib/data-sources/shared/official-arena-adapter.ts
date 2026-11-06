import type { DataSourceAdapter } from "../types";
import { fetchAllActiveAliasModels } from "../model-alias-resolver";
import { ARENA_DATASET, OFFICIAL_ARENAS, fetchOfficialArenaManifest, fetchOfficialArenaSnapshot,
  planOfficialArenaImport, type ArenaSubset } from "./official-arena";

const RATING_FIELDS = "model_id,arena_name,elo_score,confidence_interval_low,confidence_interval_high,num_battles,rank,snapshot_date";
const COMPARE_FIELDS = ["elo_score", "confidence_interval_low", "confidence_interval_high", "num_battles", "rank"] as const;

export function createOfficialArenaAdapter(subset: ArenaSubset): DataSourceAdapter {
  return {
    id: subset === "text" ? "chatbot-arena" : "vision-arena",
    name: subset === "text" ? "Chatbot Arena" : "Vision Arena",
    outputTypes: ["elo_ratings"], defaultConfig: {}, requiredSecrets: [],

    async sync(ctx) {
      const errors: Array<{ message: string }> = [];
      let recordsProcessed = 0, recordsCreated = 0, unchanged = 0;
      try {
        const snapshot = await fetchOfficialArenaSnapshot(subset, ctx.signal);
        const models = await fetchAllActiveAliasModels(ctx.supabase);
        const plan = planOfficialArenaImport(subset, snapshot.rows, models);
        recordsProcessed = snapshot.rows.length;
        if (!plan.ratings.length) throw new Error("No exact catalog identities matched");

        for (let offset = 0; offset < plan.ratings.length; offset += 100) {
          const batch = plan.ratings.slice(offset, offset + 100);
          const existing = await ctx.supabase.from("elo_ratings").select(RATING_FIELDS)
            .eq("arena_name", OFFICIAL_ARENAS[subset]).eq("snapshot_date", snapshot.publicationDate)
            .in("model_id", batch.map((rating) => rating.model_id));
          if (existing.error) throw new Error("Could not compare existing Arena evidence");
          const byId = new Map((existing.data ?? []).map((rating) => [rating.model_id, rating]));
          const changed = batch.filter((rating) => {
            const previous = byId.get(rating.model_id);
            return !previous || COMPARE_FIELDS.some((field) => previous[field] !== rating[field]);
          });
          unchanged += batch.length - changed.length;
          if (!changed.length) continue;
          const { error } = await ctx.supabase.from("elo_ratings").upsert(changed, { onConflict: "model_id,arena_name,snapshot_date" });
          if (error) errors.push({ message: "Could not save a batch of official Arena evidence" });
          else recordsCreated += changed.length;
        }
        return { success: !errors.length, recordsProcessed, recordsCreated, recordsUpdated: 0, errors,
          metadata: { source: "official_arena_snapshot", dataset: ARENA_DATASET, subset,
            revision: snapshot.revision, sha256: snapshot.sha256, bytes: snapshot.bytes,
            latestPublicationDate: snapshot.publicationDate, validOverallRows: snapshot.rows.length,
            matchedSourceRows: plan.matchedRows, unmatchedRows: plan.unmatchedModels.length,
            unmatchedModels: plan.unmatchedModels.slice(0, 20).map((name) => name.slice(0, 200)),
            unchanged, legacyMirrorUsed: false } };
      } catch {
        return { success: false, recordsProcessed, recordsCreated, recordsUpdated: 0,
          errors: [...errors, { message: "Official Arena snapshot sync failed; stale mirror and HTML fallbacks are disabled" }] };
      }
    },

    async healthCheck() {
      const start = Date.now();
      try {
        await fetchOfficialArenaManifest(subset, AbortSignal.timeout(4000));
        return { healthy: true, latencyMs: Date.now() - start,
          message: "Official snapshot manifest reachable; publication freshness and integrity are verified during sync" };
      } catch {
        return { healthy: false, latencyMs: Date.now() - start, message: "Official Arena snapshot manifest unavailable" };
      }
    },
  };
}
