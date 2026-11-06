import { afterEach, describe, expect, it, vi } from "vitest";
import adapter, { arenaDatasetUrl, OFFICIAL_TEXT_ARENA, parseOfficialArenaRow } from "./chatbot-arena";
import type { SyncContext } from "../types";
import { fetchWithRetry } from "../utils";

vi.mock("../utils", async (load) => ({ ...await load<typeof import("../utils")>(), fetchWithRetry: vi.fn() }));
const now = Date.parse("2026-11-06T12:00:00Z");
const row = { model_name: "Example 2", category: "overall", rating: 1540.2,
  rating_lower: 1530.7, rating_upper: 1549.3, vote_count: 4403, rank: 1,
  leaderboard_publish_date: "2026-10-28" };
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe("official Arena ingestion", () => {
  it("requests only the official latest text/overall subset, not the frozen mirror or agent IPS scores", () => {
    const url = new URL(arenaDatasetUrl());
    expect(url.pathname).toBe("/filter");
    expect(url.searchParams.get("dataset")).toBe("lmarena-ai/leaderboard-dataset");
    expect(url.searchParams.get("config")).toBe("text");
    expect(url.searchParams.get("split")).toBe("latest");
    expect(url.searchParams.get("where")).toBe('"category" = \'overall\'');
  });

  it("preserves publication date and safely converts official floating-point ratings for integer storage", () => {
    expect(parseOfficialArenaRow(row, now)).toMatchObject({ snapshotDate: "2026-10-28", eloScore: 1540,
      confidenceLow: 1530, confidenceHigh: 1550, votes: 4403 });
  });

  it.each([{ rating: NaN }, { rating: Infinity }, { rating: -1 }, { rating: "1540" },
    { category: "coding" }, { leaderboard_publish_date: "2025-07-18" },
    { leaderboard_publish_date: "2099-01-01" }, { leaderboard_publish_date: "invalid" }])("rejects invalid or stale data: %j", (change) => {
    expect(parseOfficialArenaRow({ ...row, ...change }, now)).toBeNull();
  });

  it("persists official evidence with its true date and never credits a near-matching version", async () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    vi.mocked(fetchWithRetry).mockResolvedValue(new Response(JSON.stringify({ num_rows_total: 2, rows: [
      { row }, { row: { ...row, model_name: "Example 2.1" } },
    ] })));
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const chain = { select: () => chain, eq: () => chain, range: async () => ({ data: [
      { id: "known", slug: "example-2", name: "Example 2", provider: "Example" },
    ], error: null }), upsert };
    const context = { supabase: { from: () => chain }, config: {}, secrets: {}, lastSyncAt: null } as unknown as SyncContext;
    const result = await adapter.sync(context);
    expect(result.success).toBe(true);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith([expect.objectContaining({ model_id: "known",
      arena_name: OFFICIAL_TEXT_ARENA, snapshot_date: "2026-10-28", elo_score: 1540 })], expect.anything());
    expect(result.metadata?.unmatchedRows).toBe(1);
  });

  it("fails closed on a stale source without writing or silently falling back", async () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    vi.mocked(fetchWithRetry).mockResolvedValue(new Response(JSON.stringify({ num_rows_total: 1,
      rows: [{ row: { ...row, leaderboard_publish_date: "2025-07-18" } }] })));
    const from = vi.fn();
    const result = await adapter.sync({ supabase: { from }, config: {}, secrets: {}, lastSyncAt: null } as unknown as SyncContext);
    expect(result.success).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });
});
