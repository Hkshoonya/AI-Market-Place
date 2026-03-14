/**
 * Capability Score Calculator (Lens 1)
 *
 * Pure performance ranking based on benchmarks + ELO + recency.
 * No popularity, market, or community signals.
 *
 * Formula:
 *   capabilityScore = weightedBenchmarks * 0.60 + normalizedELO * 0.30 + recencyBonus * 0.10
 *
 * Models with ZERO benchmarks AND zero ELO are unranked (null).
 */

import { normalizeElo, computeRecencyScore } from "@/lib/scoring/scoring-helpers";
import {
  getCorroborationMultiplier,
  type SourceCoverage,
} from "@/lib/source-coverage";

export interface CapabilityInputs {
  benchmarkScores: Array<{ slug: string; score: number }> | null;
  eloScore: number | null;
  releaseDate: string | null;
  category: string;
  sourceCoverage?: SourceCoverage | null;
}

/**
 * Category-specific benchmark groupings.
 * Primary benchmarks get 70% of the benchmark sub-weight; secondary get 30%.
 */
const CATEGORY_BENCHMARKS: Record<string, { primary: string[]; secondary: string[] }> = {
  llm: {
    primary: ["mmlu", "mmlu-pro", "gpqa", "math", "math-benchmark", "bbh"],
    secondary: ["ifeval", "hellaswag", "truthfulqa", "arena-hard-auto"],
  },
  code: {
    primary: ["humaneval", "swe-bench", "swe_bench", "bigcodebench", "livecodebench"],
    secondary: ["livebench-coding"],
  },
  multimodal: {
    primary: ["mmmu", "mathvista", "ocrbench"],
    secondary: ["mmlu", "gpqa"],
  },
  image_generation: {
    primary: [], // Image gen relies almost entirely on ELO
    secondary: [],
  },
  agentic_browser: {
    primary: ["swe-bench", "swe_bench", "terminal-bench", "terminal_bench", "os-world", "os_world"],
    secondary: ["gaia", "webarena", "web-arena", "tau-bench", "tau_bench"],
  },
};

function getCategoryBenchmarks(category: string) {
  return CATEGORY_BENCHMARKS[category] ?? CATEGORY_BENCHMARKS.llm;
}

function computeCategoryWeightedBenchmarks(
  scores: Array<{ slug: string; score: number }>,
  category: string
): number {
  const { primary, secondary } = getCategoryBenchmarks(category);

  const primaryScores: number[] = [];
  const secondaryScores: number[] = [];
  const otherScores: number[] = [];

  for (const s of scores) {
    const normalized = s.slug.toLowerCase().replace(/_/g, "-");
    if (primary.includes(s.slug) || primary.includes(normalized)) {
      primaryScores.push(s.score);
    } else if (secondary.includes(s.slug) || secondary.includes(normalized)) {
      secondaryScores.push(s.score);
    } else {
      otherScores.push(s.score);
    }
  }

  // If no primary/secondary distinction (like image_gen), use all scores equally
  if (primary.length === 0 && secondary.length === 0) {
    const all = [...primaryScores, ...secondaryScores, ...otherScores];
    if (all.length === 0) return 0;
    return all.reduce((a, b) => a + b, 0) / all.length;
  }

  // Weighted: primary 70%, secondary 30%
  const pAvg = primaryScores.length > 0
    ? primaryScores.reduce((a, b) => a + b, 0) / primaryScores.length
    : null;
  const sAvg = secondaryScores.length > 0
    ? secondaryScores.reduce((a, b) => a + b, 0) / secondaryScores.length
    : (otherScores.length > 0 ? otherScores.reduce((a, b) => a + b, 0) / otherScores.length : null);

  if (pAvg != null && sAvg != null) return pAvg * 0.7 + sAvg * 0.3;
  if (pAvg != null) return pAvg;
  if (sAvg != null) return sAvg;
  return 0;
}

/**
 * Compute capability score for a single model.
 * Returns null if model has no benchmarks AND no ELO (unranked).
 */
export function computeCapabilityScore(inputs: CapabilityInputs): number | null {
  const hasBenchmarks = inputs.benchmarkScores != null && inputs.benchmarkScores.length > 0;
  const hasELO = inputs.eloScore != null && inputs.eloScore > 0;
  const benchmarkCount = inputs.benchmarkScores?.length ?? 0;

  // Gate: must have at least one quality signal
  if (!hasBenchmarks && !hasELO) return null;

  // Benchmark sub-score (0-100)
  let benchmarkScore = 0;
  if (hasBenchmarks) {
    benchmarkScore = computeCategoryWeightedBenchmarks(inputs.benchmarkScores!, inputs.category);
  }

  // ELO sub-score (0-100), normalized from 800-1400 range
  let eloNormalized = 0;
  if (hasELO) {
    eloNormalized = normalizeElo(inputs.eloScore!);
  }

  // Recency bonus (0-100), exponential decay with 12-month half-life
  const recencyBonus = computeRecencyScore(inputs.releaseDate, { halfLifeMonths: 12 });

  // Weight distribution
  let benchWeight = 0.60;
  let eloWeight = 0.30;
  const recencyWeight = 0.10;

  // If no benchmarks, ELO absorbs benchmark weight
  if (!hasBenchmarks && hasELO) {
    eloWeight += benchWeight;
    benchWeight = 0;
  }
  // If no ELO, benchmarks absorb ELO weight
  if (hasBenchmarks && !hasELO) {
    benchWeight += eloWeight;
    eloWeight = 0;
  }

  const score = benchmarkScore * benchWeight
              + eloNormalized * eloWeight
              + recencyBonus * recencyWeight;

  let evidenceMultiplier = getCorroborationMultiplier(inputs.sourceCoverage);

  // Arena-only capability is acceptable for image-gen, but too optimistic for
  // general frontier model rankings where benchmark breadth matters.
  if (!hasBenchmarks && hasELO) {
    if (inputs.category === "image_generation") {
      evidenceMultiplier *= 1;
    } else if (inputs.category === "agentic_browser") {
      evidenceMultiplier *= 0.9;
    } else {
      evidenceMultiplier *= 0.82;
    }
  } else if (hasBenchmarks && !hasELO && benchmarkCount < 2) {
    evidenceMultiplier *= 0.94;
  }

  return Math.round(Math.min(Math.max(score * evidenceMultiplier, 0), 100) * 10) / 10;
}
