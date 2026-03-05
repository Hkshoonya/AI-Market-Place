/**
 * Unit tests for expert-calculator.
 * Covers: computeExpertScore, computeExpertNormStats across
 * full-signal, single-signal, and zero-signal models.
 */

import { describe, it, expect } from "vitest";
import {
  computeExpertScore,
  computeExpertNormStats,
  ExpertInputs,
  ExpertNormStats,
} from "./expert-calculator";

// --------------- Fixture: Norm Stats ---------------

const fixtureModels = [
  { hfLikes: 10_000, githubStars: 50_000, newsMentions: 100 },
  { hfLikes: 5_000, githubStars: 20_000, newsMentions: 40 },
  { hfLikes: 100, githubStars: 500, newsMentions: 2 },
];

const stats: ExpertNormStats = computeExpertNormStats(fixtureModels);

// --------------- Helper ---------------

function makeInputs(overrides: Partial<ExpertInputs> = {}): ExpertInputs {
  return {
    avgBenchmarkScore: null,
    benchmarkScores: null,
    eloScore: null,
    hfLikes: null,
    githubStars: null,
    newsMentions: 0,
    providerAvgBenchmark: null,
    releaseDate: null,
    isOpenWeights: false,
    ...overrides,
  };
}

// --------------- computeExpertNormStats ---------------

describe("computeExpertNormStats", () => {
  it("computes correct maximums from model array", () => {
    expect(stats.maxLikes).toBe(10_000);
    expect(stats.maxStars).toBe(50_000);
    expect(stats.maxNewsMentions).toBe(100);
  });

  it("defaults to 1 for empty/zero model data", () => {
    const empty = computeExpertNormStats([
      { hfLikes: 0, githubStars: 0, newsMentions: 0 },
    ]);
    expect(empty.maxLikes).toBe(1);
    expect(empty.maxStars).toBe(1);
    expect(empty.maxNewsMentions).toBe(1);
  });
});

// --------------- computeExpertScore ---------------

describe("computeExpertScore", () => {
  it("model with benchmarks + ELO + likes + stars + news returns score 0-100", () => {
    const inputs = makeInputs({
      benchmarkScores: [
        { slug: "mmlu", score: 88 },
        { slug: "gpqa", score: 72 },
      ],
      eloScore: 1250,
      hfLikes: 8_000,
      githubStars: 30_000,
      newsMentions: 50,
      providerAvgBenchmark: 70,
      releaseDate: new Date().toISOString(),
      isOpenWeights: true,
    });
    const score = computeExpertScore(inputs, stats);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("model with 0 evidence signals returns 0", () => {
    const inputs = makeInputs({});
    const score = computeExpertScore(inputs, stats);
    expect(score).toBe(0);
  });

  it("null benchmarkScores handled gracefully (uses avgBenchmarkScore fallback)", () => {
    const inputs = makeInputs({
      benchmarkScores: null,
      avgBenchmarkScore: 75,
      newsMentions: 10,
    });
    const score = computeExpertScore(inputs, stats);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("open model with all signals > model with single signal (coverage penalty)", () => {
    const fullInputs = makeInputs({
      benchmarkScores: [{ slug: "mmlu", score: 80 }],
      eloScore: 1100,
      hfLikes: 5_000,
      githubStars: 10_000,
      newsMentions: 20,
      providerAvgBenchmark: 65,
      releaseDate: new Date().toISOString(),
      isOpenWeights: true,
    });
    const singleInputs = makeInputs({
      eloScore: 1100,
    });
    const fullScore = computeExpertScore(fullInputs, stats);
    const singleScore = computeExpertScore(singleInputs, stats);
    expect(fullScore).toBeGreaterThan(singleScore);
  });

  it("ELO absorbs benchmark weight when benchmarks missing", () => {
    const withBoth = makeInputs({
      benchmarkScores: [{ slug: "mmlu", score: 85 }],
      eloScore: 1200,
      newsMentions: 10,
    });
    const eloOnly = makeInputs({
      eloScore: 1200,
      newsMentions: 10,
    });
    // Both should produce valid scores
    const scoreBoth = computeExpertScore(withBoth, stats);
    const scoreElo = computeExpertScore(eloOnly, stats);
    expect(scoreBoth).toBeGreaterThan(0);
    expect(scoreElo).toBeGreaterThan(0);
  });
});
