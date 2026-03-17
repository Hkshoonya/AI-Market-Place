import { describe, it, expect, vi, afterEach } from "vitest";
import { computeCapabilityScore, CapabilityInputs } from "@/lib/scoring/capability-calculator";

describe("computeCapabilityScore", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns score 0-100 for normal LLM model with benchmarks + ELO + release date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00Z"));

    const inputs: CapabilityInputs = {
      benchmarkScores: [
        { slug: "mmlu", score: 85 },
        { slug: "gpqa", score: 70 },
        { slug: "math", score: 75 },
      ],
      eloScore: 1200,
      releaseDate: "2025-12-01",
      category: "llm",
    };
    const result = computeCapabilityScore(inputs);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(0);
    expect(result!).toBeLessThanOrEqual(100);
  });

  it("returns null for model with zero benchmarks AND null ELO", () => {
    const inputs: CapabilityInputs = {
      benchmarkScores: [],
      eloScore: null,
      releaseDate: "2025-06-01",
      category: "llm",
    };
    expect(computeCapabilityScore(inputs)).toBeNull();
  });

  it("returns null for null benchmarkScores AND null ELO", () => {
    const inputs: CapabilityInputs = {
      benchmarkScores: null,
      eloScore: null,
      releaseDate: "2025-06-01",
      category: "llm",
    };
    expect(computeCapabilityScore(inputs)).toBeNull();
  });

  it("returns score > 0 for model with ELO only (no benchmarks)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00Z"));

    const inputs: CapabilityInputs = {
      benchmarkScores: [],
      eloScore: 1100,
      releaseDate: "2025-12-01",
      category: "llm",
    };
    const result = computeCapabilityScore(inputs);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(0);
  });

  it("penalizes LLM capability when only arena ELO is available", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00Z"));

    const result = computeCapabilityScore({
      benchmarkScores: [],
      eloScore: 1364,
      releaseDate: "2026-02-01",
      category: "llm",
    });

    expect(result).not.toBeNull();
    expect(result!).toBeLessThan(85);
  });

  it("keeps arena-only image-generation models less penalized than LLMs", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00Z"));

    const llmOnlyArena = computeCapabilityScore({
      benchmarkScores: [],
      eloScore: 1364,
      releaseDate: "2026-02-01",
      category: "llm",
    });
    const imageOnlyArena = computeCapabilityScore({
      benchmarkScores: [],
      eloScore: 1364,
      releaseDate: "2026-02-01",
      category: "image_generation",
    });

    expect(llmOnlyArena).not.toBeNull();
    expect(imageOnlyArena).not.toBeNull();
    expect(imageOnlyArena!).toBeGreaterThan(llmOnlyArena!);
  });

  it("returns score > 0 for model with benchmarks only (no ELO)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00Z"));

    const inputs: CapabilityInputs = {
      benchmarkScores: [
        { slug: "mmlu", score: 80 },
        { slug: "gpqa", score: 65 },
      ],
      eloScore: null,
      releaseDate: "2025-12-01",
      category: "llm",
    };
    const result = computeCapabilityScore(inputs);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(0);
  });

  it("penalizes sparse benchmark-only capability more than broader benchmark coverage", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00Z"));

    const sparse = computeCapabilityScore({
      benchmarkScores: [{ slug: "mmlu", score: 88 }],
      eloScore: null,
      releaseDate: "2025-12-01",
      category: "llm",
    });
    const broader = computeCapabilityScore({
      benchmarkScores: [
        { slug: "mmlu", score: 88 },
        { slug: "gpqa", score: 84 },
        { slug: "math", score: 82 },
      ],
      eloScore: null,
      releaseDate: "2025-12-01",
      category: "llm",
    });

    expect(sparse).not.toBeNull();
    expect(broader).not.toBeNull();
    expect(broader!).toBeGreaterThan(sparse!);
  });

  it("handles image_generation category with ELO (no primary benchmarks)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00Z"));

    const inputs: CapabilityInputs = {
      benchmarkScores: [],
      eloScore: 1300,
      releaseDate: "2026-01-01",
      category: "image_generation",
    };
    const result = computeCapabilityScore(inputs);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(0);
  });

  it("still lets image-generation arena-only models outrank LLM arena-only ones while damping them", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00Z"));

    const llmOnlyArena = computeCapabilityScore({
      benchmarkScores: [],
      eloScore: 1300,
      releaseDate: "2026-01-01",
      category: "llm",
    });
    const imageOnlyArena = computeCapabilityScore({
      benchmarkScores: [],
      eloScore: 1300,
      releaseDate: "2026-01-01",
      category: "image_generation",
    });

    expect(llmOnlyArena).not.toBeNull();
    expect(imageOnlyArena).not.toBeNull();
    expect(imageOnlyArena!).toBeGreaterThan(llmOnlyArena!);
    expect(imageOnlyArena!).toBeLessThan(80);
  });

  it("null benchmarkScores treated same as empty array", () => {
    const withNull: CapabilityInputs = {
      benchmarkScores: null,
      eloScore: 1100,
      releaseDate: null,
      category: "llm",
    };
    const withEmpty: CapabilityInputs = {
      benchmarkScores: [],
      eloScore: 1100,
      releaseDate: null,
      category: "llm",
    };
    expect(computeCapabilityScore(withNull)).toBe(computeCapabilityScore(withEmpty));
  });

  it("treats livecodebench as a primary coding benchmark", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00Z"));

    const strongPrimary: CapabilityInputs = {
      benchmarkScores: [
        { slug: "livecodebench", score: 90 },
        { slug: "livebench-coding", score: 30 },
      ],
      eloScore: null,
      releaseDate: "2025-12-01",
      category: "code",
    };

    const secondaryOnly: CapabilityInputs = {
      benchmarkScores: [
        { slug: "livebench-coding", score: 30 },
      ],
      eloScore: null,
      releaseDate: "2025-12-01",
      category: "code",
    };

    expect(computeCapabilityScore(strongPrimary)!).toBeGreaterThan(
      computeCapabilityScore(secondaryOnly)!
    );
  });
});
