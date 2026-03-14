import { describe, expect, it } from "vitest";

import { canonicalizeArenaFamily, collapseArenaRatings } from "./arena-family";

describe("canonicalizeArenaFamily", () => {
  it("maps common chatbot arena variants into one canonical family", () => {
    expect(canonicalizeArenaFamily("chatbot-arena")).toEqual({
      familyKey: "chatbot-arena",
      displayName: "Chatbot Arena",
    });
    expect(canonicalizeArenaFamily("chatbot arena")).toEqual({
      familyKey: "chatbot-arena",
      displayName: "Chatbot Arena",
    });
    expect(canonicalizeArenaFamily("lmarena")).toEqual({
      familyKey: "chatbot-arena",
      displayName: "Chatbot Arena",
    });
  });
});

describe("collapseArenaRatings", () => {
  it("collapses raw variants into one top-level arena family and keeps the freshest snapshot", () => {
    const collapsed = collapseArenaRatings([
      {
        arena_name: "chatbot-arena",
        elo_score: 1401,
        snapshot_date: "2026-03-10",
        num_battles: 1200,
      },
      {
        arena_name: "chatbot arena",
        elo_score: 1420,
        snapshot_date: "2026-03-12",
        num_battles: 1400,
      },
      {
        arena_name: "vision-arena",
        elo_score: 1184,
        snapshot_date: "2026-03-11",
      },
    ]);

    expect(collapsed).toHaveLength(2);

    expect(collapsed[0]).toMatchObject({
      familyKey: "chatbot-arena",
      displayName: "Chatbot Arena",
      arena_name: "chatbot arena",
      elo_score: 1420,
      variantCount: 2,
      rawArenaNames: ["chatbot arena", "chatbot-arena"],
    });

    expect(collapsed[1]).toMatchObject({
      familyKey: "vision-arena",
      displayName: "Vision Arena",
      arena_name: "vision-arena",
      elo_score: 1184,
      variantCount: 1,
    });
  });

  it("prefers the higher-battle row when snapshots are tied", () => {
    const collapsed = collapseArenaRatings([
      {
        arena_name: "chatbot-arena",
        elo_score: 1399,
        snapshot_date: "2026-03-12",
        num_battles: 600,
      },
      {
        arena_name: "chatbot-arena",
        elo_score: 1405,
        snapshot_date: "2026-03-12",
        num_battles: 1500,
      },
    ]);

    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]).toMatchObject({
      elo_score: 1405,
      num_battles: 1500,
      variantCount: 2,
    });
  });
});
