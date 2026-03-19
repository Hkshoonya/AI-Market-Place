import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BenchmarksTab } from "./benchmarks-tab";

describe("BenchmarksTab", () => {
  it("collapses duplicate raw arena names into one canonical arena family", () => {
    render(
      <BenchmarksTab
        benchmarkScores={[]}
        eloRatings={[
          {
            arena_name: "Chatbot Arena",
            elo_score: 1320,
            rank: 5,
            num_battles: 1200,
            snapshot_date: "2026-03-15T00:00:00.000Z",
          },
          {
            arena_name: "chatbot-arena",
            elo_score: 1312,
            rank: 6,
            num_battles: 1180,
            snapshot_date: "2026-03-10T00:00:00.000Z",
          },
        ]}
      />
    );

    expect(screen.getByText("Arena ELO Ratings")).toBeInTheDocument();
    expect(screen.getAllByText("Chatbot Arena")).toHaveLength(1);
    expect(screen.getByText("2 snapshots")).toBeInTheDocument();
    expect(screen.getByText("1320")).toBeInTheDocument();
  });
});
