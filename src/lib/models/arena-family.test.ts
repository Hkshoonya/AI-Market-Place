import { describe, expect, it } from "vitest";

import { collapseArenaRatings } from "./arena-family";

describe("collapseArenaRatings", () => {
  it("deduplicates identical arena rows before counting variants", () => {
    const result = collapseArenaRatings([
      {
        arena_name: "chatbot-arena",
        elo_score: 1443,
        rank: 5,
        num_battles: 12000,
        snapshot_date: "2026-03-13",
      },
      {
        arena_name: "chatbot-arena",
        elo_score: 1443,
        rank: 5,
        num_battles: 12000,
        snapshot_date: "2026-03-13",
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.variantCount).toBe(1);
    expect(result[0]?.variants).toHaveLength(1);
  });

  it("keeps distinct snapshots within the same arena family", () => {
    const result = collapseArenaRatings([
      {
        arena_name: "chatbot-arena",
        elo_score: 1428,
        rank: 4,
        num_battles: 25442,
        snapshot_date: "2026-03-13",
      },
      {
        arena_name: "chatbot-arena",
        elo_score: 1340,
        rank: 31,
        num_battles: 19404,
        snapshot_date: "2026-03-12",
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.variantCount).toBe(2);
    expect(result[0]?.variants).toHaveLength(2);
    expect(result[0]?.elo_score).toBe(1428);
  });
});
