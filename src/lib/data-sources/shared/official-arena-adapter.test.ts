import { afterEach, describe, expect, it, vi } from "vitest";
import { createOfficialArenaAdapter } from "./official-arena-adapter";
import { fetchOfficialArenaManifest, fetchOfficialArenaSnapshot, parseOfficialArenaRow } from "./official-arena";
import type { SyncContext } from "../types";

vi.mock("./official-arena", async (load) => ({ ...await load<typeof import("./official-arena")>(),
  fetchOfficialArenaSnapshot: vi.fn(), fetchOfficialArenaManifest: vi.fn() }));
afterEach(() => vi.resetAllMocks());
const row = parseOfficialArenaRow({ model_name: "Example 2", organization: "Example", category: "overall", rating: 1500,
  vote_count: 4000, rank: 1, leaderboard_publish_date: "2026-10-28" }, Date.parse("2026-11-06"))!;

function context(existing: unknown[] = [], readError: unknown = null, writeError: unknown = null) {
  const upsert = vi.fn().mockResolvedValue({ error: writeError });
  const modelChain = { select: () => modelChain, eq: () => modelChain, range: async () => ({ data: [
    { id: "known", slug: "example-2", name: "Example 2", provider: "Example" },
  ], error: null }) };
  const eloChain = { select: () => eloChain, eq: () => eloChain,
    in: async () => ({ data: existing, error: readError }), upsert };
  const ctx = { config: {}, secrets: {}, lastSyncAt: null,
    supabase: { from: (table: string) => table === "models" ? modelChain : eloChain } } as unknown as SyncContext;
  return { ctx, upsert };
}

function snapshot() {
  vi.mocked(fetchOfficialArenaSnapshot).mockResolvedValue({ rows: [row, { ...row, modelName: "Example 2.1" }],
    revision: "a".repeat(40), sha256: "b".repeat(64), bytes: 1024, publicationDate: row.snapshotDate });
}

describe("official Arena adapter", () => {
  it.each(["text", "vision"] as const)("persists %s with exact identity, real publication and new provenance", async (subset) => {
    snapshot(); const { ctx, upsert } = context();
    const result = await createOfficialArenaAdapter(subset).sync(ctx);
    expect(result.success).toBe(true);
    expect(upsert).toHaveBeenCalledWith([expect.objectContaining({ model_id: "known",
      arena_name: `arena-${subset}-official`, snapshot_date: "2026-10-28", elo_score: 1500 })], expect.anything());
    expect(result.metadata).toMatchObject({ unmatchedRows: 1, matchedSourceRows: 1, legacyMirrorUsed: false });
  });

  it("skips unchanged records instead of rewriting them every cron run", async () => {
    snapshot(); const { ctx, upsert } = context([{ model_id: "known", elo_score: row.eloScore,
      confidence_interval_low: row.confidenceLow, confidence_interval_high: row.confidenceHigh, num_battles: row.votes, rank: row.rank }]);
    const result = await createOfficialArenaAdapter("text").sync(ctx);
    expect(result.success).toBe(true);
    expect(result.metadata?.unchanged).toBe(1);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("does not turn a comparison failure into blind database writes", async () => {
    snapshot(); const { ctx, upsert } = context([], { message: "private diagnostic" });
    const result = await createOfficialArenaAdapter("text").sync(ctx);
    expect(result.success).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("private diagnostic");
  });

  it("reports write failures and does not claim successful imports", async () => {
    snapshot(); const { ctx } = context([], null, { message: "private write diagnostic" });
    const result = await createOfficialArenaAdapter("vision").sync(ctx);
    expect(result.success).toBe(false);
    expect(result.recordsCreated).toBe(0);
    expect(JSON.stringify(result)).not.toContain("private write diagnostic");
  });

  it("does not query the database or fall back if snapshot verification fails", async () => {
    vi.mocked(fetchOfficialArenaSnapshot).mockRejectedValue(new Error("invalid hash"));
    const from = vi.fn();
    const result = await createOfficialArenaAdapter("text").sync({ ...context().ctx, supabase: { from } } as unknown as SyncContext);
    expect(result.success).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it("distinguishes manifest availability from verified publication freshness", async () => {
    vi.mocked(fetchOfficialArenaManifest).mockResolvedValue({ revision: "a".repeat(40), path: "text/latest.parquet", size: 1024, sha256: "b".repeat(64) });
    const health = await createOfficialArenaAdapter("text").healthCheck({});
    expect(health.healthy).toBe(true);
    expect(health.message).toContain("verified during sync");
    expect(fetchOfficialArenaSnapshot).not.toHaveBeenCalled();
  });
});
