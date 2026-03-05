/**
 * Unit tests for quality-calculator.
 * Covers: calculateQualityScore, computeNormalizationStats across
 * category weight profiles, proprietary models, and null/edge inputs.
 */

import { describe, it, expect } from "vitest";
import {
  calculateQualityScore,
  computeNormalizationStats,
  QualityInputs,
  NormalizationStats,
} from "./quality-calculator";

// --------------- Fixture: Normalization Stats ---------------

const fixtureModels = [
  { hf_downloads: 500_000, hf_likes: 10_000, newsMentions: 50 },
  { hf_downloads: 100_000, hf_likes: 5_000, newsMentions: 30 },
  { hf_downloads: 1_000, hf_likes: 100, newsMentions: 2 },
];

const stats: NormalizationStats = computeNormalizationStats(fixtureModels);

// --------------- Helper ---------------

function makeInputs(overrides: Partial<QualityInputs> = {}): QualityInputs {
  return {
    existingScore: null,
    hfDownloads: null,
    hfLikes: null,
    avgBenchmarkScore: null,
    benchmarkScores: null,
    releaseDate: null,
    isOpenWeights: false,
    trendingScore: null,
    newsMentions: 0,
    eloScore: null,
    eloRank: null,
    category: "llm",
    providerAvgBenchmark: null,
    parameterCount: null,
    ...overrides,
  };
}

// --------------- computeNormalizationStats ---------------

describe("computeNormalizationStats", () => {
  it("computes correct max values from model array", () => {
    expect(stats.maxDownloads).toBe(500_000);
    expect(stats.maxLikes).toBe(10_000);
    expect(stats.maxNewsMentions).toBe(50);
  });

  it("defaults to 1 when all values are null/0", () => {
    const empty = computeNormalizationStats([
      { hf_downloads: null, hf_likes: null, newsMentions: 0 },
    ]);
    expect(empty.maxDownloads).toBe(1);
    expect(empty.maxLikes).toBe(1);
    expect(empty.maxNewsMentions).toBe(1);
  });
});

// --------------- calculateQualityScore ---------------

describe("calculateQualityScore", () => {
  it("returns score 0-100 for a normal LLM model with benchmarks + ELO + downloads + likes", () => {
    const inputs = makeInputs({
      benchmarkScores: [
        { slug: "mmlu", score: 85 },
        { slug: "gpqa", score: 70 },
      ],
      eloScore: 1200,
      hfDownloads: 50_000,
      hfLikes: 1_000,
      newsMentions: 5,
      releaseDate: new Date().toISOString(),
      isOpenWeights: true,
      category: "llm",
    });
    const score = calculateQualityScore(inputs, stats);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("proprietary model (isOpenWeights=false) with no HF data scores via ELO+benchmarks", () => {
    const inputs = makeInputs({
      benchmarkScores: [{ slug: "mmlu", score: 90 }],
      eloScore: 1300,
      isOpenWeights: false,
      hfDownloads: null,
      hfLikes: null,
      category: "llm",
    });
    const score = calculateQualityScore(inputs, stats);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("model with all-null inputs returns 0 (no evidence signals)", () => {
    const inputs = makeInputs({});
    const score = calculateQualityScore(inputs, stats);
    expect(score).toBe(0);
  });

  it("image_generation category applies different weight profile", () => {
    const llmInputs = makeInputs({
      eloScore: 1100,
      isOpenWeights: true,
      newsMentions: 10,
      hfDownloads: 10_000,
      hfLikes: 500,
      releaseDate: new Date().toISOString(),
      category: "llm",
    });
    const imgInputs = makeInputs({
      ...llmInputs,
      category: "image_generation",
    });
    const llmScore = calculateQualityScore(llmInputs, stats);
    const imgScore = calculateQualityScore(imgInputs, stats);
    // Both produce valid scores; they differ because of different weight profiles
    expect(llmScore).toBeGreaterThan(0);
    expect(imgScore).toBeGreaterThan(0);
    expect(llmScore).not.toBe(imgScore);
  });

  it("proxy quality signals boost models without direct benchmarks/ELO", () => {
    const withoutProxy = makeInputs({
      isOpenWeights: true,
      hfDownloads: 50_000,
      hfLikes: 500,
      newsMentions: 3,
      releaseDate: new Date().toISOString(),
      category: "llm",
    });
    const withProxy = makeInputs({
      ...withoutProxy,
      providerAvgBenchmark: 75,
      parameterCount: 70,
    });
    const scoreWithout = calculateQualityScore(withoutProxy, stats);
    const scoreWith = calculateQualityScore(withProxy, stats);
    // With proxy signals, the cap is raised from 50 to up to 65
    // so score with proxy should be >= score without proxy
    expect(scoreWith).toBeGreaterThanOrEqual(scoreWithout);
  });

  it("blends with existing AA score when available", () => {
    const inputs = makeInputs({
      existingScore: 80,
      benchmarkScores: [{ slug: "mmlu", score: 85 }],
      eloScore: 1200,
      isOpenWeights: true,
      hfDownloads: 50_000,
      hfLikes: 500,
      newsMentions: 5,
      releaseDate: new Date().toISOString(),
      category: "llm",
    });
    const score = calculateQualityScore(inputs, stats);
    // Blended: 0.6 * 80 + 0.4 * computed = somewhere near 70-90
    expect(score).toBeGreaterThan(40);
    expect(score).toBeLessThanOrEqual(100);
  });
});
