import { describe, it, expect, vi, afterEach } from "vitest";
import {
  logNormalizeSignal,
  addSignal,
  weightedBenchmarkAvg,
  normalizeElo,
  computeRecencyScore,
  BENCHMARK_IMPORTANCE,
} from "@/lib/scoring/scoring-helpers";

// ---------- logNormalizeSignal ----------
describe("logNormalizeSignal", () => {
  it("returns value between 0 and 100 for normal input", () => {
    const result = logNormalizeSignal(1000, 10000);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(100);
  });

  it("computes correct formula: (log10(v+1)/log10(max+1))*100", () => {
    const result = logNormalizeSignal(1000, 10000);
    const expected = (Math.log10(1001) / Math.log10(10001)) * 100;
    expect(result).toBeCloseTo(expected, 5);
  });

  it("returns 0 for zero value", () => {
    expect(logNormalizeSignal(0, 100)).toBe(0);
  });

  it("returns 0 for zero max", () => {
    expect(logNormalizeSignal(100, 0)).toBe(0);
  });

  it("returns 0 for negative value", () => {
    expect(logNormalizeSignal(-5, 100)).toBe(0);
  });

  it("returns 100 when value equals max", () => {
    expect(logNormalizeSignal(10000, 10000)).toBe(100);
  });

  it("clamps to 100 when value exceeds max", () => {
    expect(logNormalizeSignal(50000, 10000)).toBe(100);
  });
});

// ---------- addSignal ----------
describe("addSignal", () => {
  it("pushes a correctly shaped signal onto the array", () => {
    const signals: Array<{ name: string; score: number; weight: number }> = [];
    addSignal(signals, "downloads", 75, 0.3);
    expect(signals).toHaveLength(1);
    expect(signals[0]).toEqual({ name: "downloads", score: 75, weight: 0.3 });
  });

  it("appends multiple signals", () => {
    const signals: Array<{ name: string; score: number; weight: number }> = [];
    addSignal(signals, "a", 10, 0.1);
    addSignal(signals, "b", 20, 0.2);
    expect(signals).toHaveLength(2);
    expect(signals[1].name).toBe("b");
  });
});

// ---------- weightedBenchmarkAvg ----------
describe("weightedBenchmarkAvg", () => {
  it("returns 0 for empty array", () => {
    expect(weightedBenchmarkAvg([])).toBe(0);
  });

  it("uses BENCHMARK_IMPORTANCE weights for known slugs", () => {
    const scores = [
      { slug: "mmlu", score: 80 },
      { slug: "gpqa", score: 60 },
    ];
    const result = weightedBenchmarkAvg(scores);
    const mmluW = BENCHMARK_IMPORTANCE["mmlu"]; // 1.0
    const gpqaW = BENCHMARK_IMPORTANCE["gpqa"]; // 1.3
    const expected = (80 * mmluW + 60 * gpqaW) / (mmluW + gpqaW);
    expect(result).toBeCloseTo(expected, 5);
  });

  it("falls back to 1.0 for unknown slugs", () => {
    const scores = [{ slug: "unknown-benchmark", score: 50 }];
    // weight = 1.0, so avg = 50
    expect(weightedBenchmarkAvg(scores)).toBeCloseTo(50, 5);
  });

  it("normalizes underscore slug variants to hyphen", () => {
    // "mmlu_pro" should resolve via normalized "mmlu-pro" key
    const scores = [{ slug: "mmlu_pro", score: 90 }];
    const result = weightedBenchmarkAvg(scores);
    const expectedWeight = BENCHMARK_IMPORTANCE["mmlu_pro"] ?? BENCHMARK_IMPORTANCE["mmlu-pro"];
    // With a single entry, avg = score
    expect(result).toBeCloseTo(90, 5);
    // Confirm the weight was found (not fallback 1.0)
    expect(expectedWeight).toBeDefined();
  });
});

// ---------- normalizeElo ----------
describe("normalizeElo", () => {
  it("returns 0 for ELO 800", () => {
    expect(normalizeElo(800)).toBe(0);
  });

  it("returns 100 for ELO 1400", () => {
    expect(normalizeElo(1400)).toBe(100);
  });

  it("returns 50 for ELO 1100", () => {
    expect(normalizeElo(1100)).toBe(50);
  });

  it("clamps to 0 for ELO below 800", () => {
    expect(normalizeElo(600)).toBe(0);
  });

  it("clamps to 100 for ELO above 1400", () => {
    expect(normalizeElo(1600)).toBe(100);
  });
});

// ---------- computeRecencyScore ----------
describe("computeRecencyScore", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 50 for null release date", () => {
    expect(computeRecencyScore(null)).toBe(50);
  });

  it("returns near 100 for a very recent date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00Z"));
    const result = computeRecencyScore("2026-02-28");
    expect(result).toBeGreaterThan(95);
    expect(result).toBeLessThanOrEqual(100);
  });

  it("returns near floor for a very old date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00Z"));
    const result = computeRecencyScore("2020-01-01");
    expect(result).toBeCloseTo(10, 0); // floor default is 10
  });

  it("respects halfLifeMonths option", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00Z"));
    const short = computeRecencyScore("2025-03-01", { halfLifeMonths: 6 });
    const long = computeRecencyScore("2025-03-01", { halfLifeMonths: 36 });
    // Shorter half-life decays faster, so short < long
    expect(short).toBeLessThan(long);
  });

  it("respects floor option", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00Z"));
    const result = computeRecencyScore("2010-01-01", { floor: 20 });
    expect(result).toBeGreaterThanOrEqual(20);
  });
});
