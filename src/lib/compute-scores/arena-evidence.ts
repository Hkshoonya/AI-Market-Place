import { normalizeElo } from "@/lib/scoring/scoring-helpers";

export interface ArenaSnapshot {
  model_id: string;
  arena_name: string;
  elo_score: number;
  snapshot_date: string;
}

function arenaKey(name: string) {
  return name.trim().toLowerCase().replace(/[\s_]+/g, "-");
}

/** Historical peaks and scores from unrelated arenas must not compete as raw ratings. */
export function selectArenaEvidence(
  snapshots: ArenaSnapshot[],
  models: Array<{ id: string; category: string }>,
  now = Date.now()
) {
  const eligibleIds = new Set(models.map((model) => model.id));
  const latest = new Map<string, ArenaSnapshot>();
  for (const row of snapshots) {
    const timestamp = Date.parse(row.snapshot_date);
    if (!eligibleIds.has(row.model_id) || !Number.isFinite(row.elo_score) || row.elo_score <= 0
      || !Number.isFinite(timestamp) || timestamp > now) continue;
    const arena = arenaKey(row.arena_name);
    // Legacy chatbot-arena rows were refreshed from a frozen mirror using sync
    // dates, so their apparent freshness cannot establish current evidence.
    if (arena !== "arena-text-official" && arena !== "arena-vision-official") continue;
    const key = `${row.model_id}:${arena}`;
    const previous = latest.get(key);
    if (!previous || timestamp > Date.parse(previous.snapshot_date)
      || (timestamp === Date.parse(previous.snapshot_date) && row.elo_score < previous.elo_score)) {
      latest.set(key, { ...row, arena_name: arena });
    }
  }

  const maxima = new Map<string, number>();
  for (const row of latest.values()) {
    maxima.set(row.arena_name, Math.max(maxima.get(row.arena_name) ?? 1400, row.elo_score));
  }
  const eloMap = new Map<string, number>();
  const eloNormalizedMap = new Map<string, number>();
  const eloSourcesByModel = new Map<string, Set<string>>();
  for (const model of models) {
    if (!["llm", "code", "agentic_browser", "multimodal", "vision"].includes(model.category)) continue;
    // Vision Arena evaluates image understanding, not image generation.
    const row = model.category === "vision" ? latest.get(`${model.id}:arena-vision-official`)
      : latest.get(`${model.id}:arena-text-official`)
        ?? (model.category === "multimodal" ? latest.get(`${model.id}:arena-vision-official`) : undefined);
    if (!row) continue;
    eloMap.set(model.id, row.elo_score);
    eloNormalizedMap.set(model.id, normalizeElo(row.elo_score, maxima.get(row.arena_name)));
    eloSourcesByModel.set(model.id, new Set([row.arena_name]));
  }
  return { eloMap, eloNormalizedMap, eloSourcesByModel };
}
