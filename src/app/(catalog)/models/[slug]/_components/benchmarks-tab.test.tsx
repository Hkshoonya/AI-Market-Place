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

  it("shows recent benchmark evidence when structured scores are still empty", () => {
    render(
      <BenchmarksTab
        benchmarkScores={[]}
        eloRatings={[]}
        recentBenchmarkEvidence={[
          {
            id: "bench-1",
            title: "MiniMax M2.7 enters new leaderboard",
            summary: "Aider Polyglot and provider benchmarking both reported new results.",
            source: "provider-blog",
            signalType: "benchmark",
            signalLabel: "Benchmarks",
            signalImportance: "high",
            published_at: "2026-03-27T21:00:00.000Z",
            url: "https://example.com/bench",
          },
        ]}
      />
    );

    expect(
      screen.getByText("Recent Benchmark Evidence")
    ).toBeInTheDocument();
    expect(
      screen.getByText("MiniMax M2.7 enters new leaderboard")
    ).toBeInTheDocument();
    expect(screen.getByText("View source")).toHaveAttribute(
      "href",
      "https://example.com/bench"
    );
  });
});
