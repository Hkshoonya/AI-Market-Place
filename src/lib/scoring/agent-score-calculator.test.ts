/**
 * Unit tests for agent-score-calculator.
 * Covers: normalizeAgentSlug, computeAgentBenchmarkWeights, computeAgentScore
 * across known/unknown slugs, zero benchmarks, and multiple benchmarks.
 */

import { describe, it, expect } from "vitest";
import {
  normalizeAgentSlug,
  computeAgentBenchmarkWeights,
  computeAgentScore,
  AgentBenchmarkScore,
  BenchmarkWeight,
} from "./agent-score-calculator";

// --------------- normalizeAgentSlug ---------------

describe("normalizeAgentSlug", () => {
  it("maps valid agent slugs to canonical form", () => {
    expect(normalizeAgentSlug("swe-bench")).toBe("swe-bench");
    expect(normalizeAgentSlug("swe_bench")).toBe("swe-bench");
    expect(normalizeAgentSlug("swebench")).toBe("swe-bench");
    expect(normalizeAgentSlug("swe-bench-verified")).toBe("swe-bench");
    expect(normalizeAgentSlug("humaneval")).toBe("humaneval");
    expect(normalizeAgentSlug("human-eval")).toBe("humaneval");
    expect(normalizeAgentSlug("human_eval")).toBe("humaneval");
    expect(normalizeAgentSlug("os-world")).toBe("os-world");
    expect(normalizeAgentSlug("osworld")).toBe("os-world");
    expect(normalizeAgentSlug("webarena")).toBe("webarena");
    expect(normalizeAgentSlug("web-arena")).toBe("webarena");
    expect(normalizeAgentSlug("tau-bench")).toBe("tau-bench");
    expect(normalizeAgentSlug("taubench")).toBe("tau-bench");
    expect(normalizeAgentSlug("gaia")).toBe("gaia");
    expect(normalizeAgentSlug("terminal-bench")).toBe("terminal-bench");
    expect(normalizeAgentSlug("livebench-coding")).toBe("livebench-coding");
  });

  it("returns null for non-agent slugs", () => {
    expect(normalizeAgentSlug("mmlu")).toBeNull();
    expect(normalizeAgentSlug("gpqa")).toBeNull();
    expect(normalizeAgentSlug("hellaswag")).toBeNull();
    expect(normalizeAgentSlug("random-benchmark")).toBeNull();
    expect(normalizeAgentSlug("")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(normalizeAgentSlug("SWE-Bench")).toBe("swe-bench");
    expect(normalizeAgentSlug("HumanEval")).toBe("humaneval");
    expect(normalizeAgentSlug("GAIA")).toBe("gaia");
  });
});

// --------------- computeAgentBenchmarkWeights ---------------

describe("computeAgentBenchmarkWeights", () => {
  it("returns weights for all known agent benchmarks", () => {
    const allScores = [
      { benchmarkSlug: "swe-bench", modelId: "m1" },
      { benchmarkSlug: "humaneval", modelId: "m1" },
      { benchmarkSlug: "humaneval", modelId: "m2" },
      { benchmarkSlug: "gaia", modelId: "m1" },
    ];
    const weights = computeAgentBenchmarkWeights(allScores);
    expect(weights.length).toBe(8); // all 8 canonical agent benchmarks
    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0, 5);
  });

  it("returns default weights when no data provided", () => {
    const weights = computeAgentBenchmarkWeights([]);
    expect(weights.length).toBe(8);
    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0, 5);
  });
});

// --------------- computeAgentScore ---------------

describe("computeAgentScore", () => {
  const defaultWeights: BenchmarkWeight[] = computeAgentBenchmarkWeights([]);

  it("returns null with 0 agent benchmarks", () => {
    const result = computeAgentScore([], defaultWeights);
    expect(result).toBeNull();
  });

  it("returns null for non-agent benchmark slugs only", () => {
    const scores: AgentBenchmarkScore[] = [
      { benchmarkSlug: "mmlu", score: 85, scoreNormalized: 85 },
      { benchmarkSlug: "gpqa", score: 70, scoreNormalized: 70 },
    ];
    const result = computeAgentScore(scores, defaultWeights);
    expect(result).toBeNull();
  });

  it("returns weighted composite for multiple agent benchmarks", () => {
    const scores: AgentBenchmarkScore[] = [
      { benchmarkSlug: "swe-bench", score: 72, scoreNormalized: 72 },
      { benchmarkSlug: "humaneval", score: 88, scoreNormalized: 88 },
      { benchmarkSlug: "gaia", score: 65, scoreNormalized: 65 },
    ];
    const result = computeAgentScore(scores, defaultWeights);
    expect(result).not.toBeNull();
    expect(result!.agentScore).toBeGreaterThan(0);
    expect(result!.agentScore).toBeLessThanOrEqual(100);
    expect(result!.benchmarkCount).toBe(3);
  });

  it("breakdown has one entry per unique agent benchmark", () => {
    const scores: AgentBenchmarkScore[] = [
      { benchmarkSlug: "swe-bench", score: 72, scoreNormalized: 72 },
      { benchmarkSlug: "humaneval", score: 88, scoreNormalized: 88 },
      { benchmarkSlug: "terminal-bench", score: 60, scoreNormalized: 60 },
    ];
    const result = computeAgentScore(scores, defaultWeights);
    expect(result).not.toBeNull();
    expect(result!.breakdown).toHaveLength(3);
    const slugs = result!.breakdown.map((b) => b.benchmarkSlug);
    expect(slugs).toContain("swe-bench");
    expect(slugs).toContain("humaneval");
    expect(slugs).toContain("terminal-bench");
  });

  it("deduplicates: keeps best score per benchmark", () => {
    const scores: AgentBenchmarkScore[] = [
      { benchmarkSlug: "swe-bench", score: 50, scoreNormalized: 50 },
      { benchmarkSlug: "swe-bench-verified", score: 72, scoreNormalized: 72 },
    ];
    const result = computeAgentScore(scores, defaultWeights);
    expect(result).not.toBeNull();
    expect(result!.benchmarkCount).toBe(1);
    // Should keep the higher score (72)
    expect(result!.breakdown[0].rawScore).toBe(72);
  });

  it("applies coverage penalty: fewer benchmarks = lower score", () => {
    const oneScore: AgentBenchmarkScore[] = [
      { benchmarkSlug: "swe-bench", score: 80, scoreNormalized: 80 },
    ];
    const fourScores: AgentBenchmarkScore[] = [
      { benchmarkSlug: "swe-bench", score: 80, scoreNormalized: 80 },
      { benchmarkSlug: "humaneval", score: 80, scoreNormalized: 80 },
      { benchmarkSlug: "gaia", score: 80, scoreNormalized: 80 },
      { benchmarkSlug: "terminal-bench", score: 80, scoreNormalized: 80 },
    ];
    const r1 = computeAgentScore(oneScore, defaultWeights);
    const r4 = computeAgentScore(fourScores, defaultWeights);
    expect(r1).not.toBeNull();
    expect(r4).not.toBeNull();
    expect(r4!.agentScore).toBeGreaterThan(r1!.agentScore);
  });
});
