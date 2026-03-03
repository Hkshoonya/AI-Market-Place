/**
 * Expert Consensus Score Calculator (Lens 3)
 *
 * "What would AI researchers agree on?"
 *
 * Formula:
 *   expertScore = benchmarks * 0.35 + elo * 0.25
 *               + communitySignal * 0.20
 *               + citationProxy * 0.10
 *               + recency * 0.10
 */

import { EVIDENCE_COVERAGE_PENALTY, getCoveragePenalty } from "@/lib/constants/scoring";
import {
  weightedBenchmarkAvg,
  logNormalizeSignal,
  normalizeElo,
  computeRecencyScore,
} from "@/lib/scoring/scoring-helpers";

export interface ExpertInputs {
  avgBenchmarkScore: number | null;
  benchmarkScores: Array<{ slug: string; score: number }> | null;
  eloScore: number | null;
  hfLikes: number | null;
  githubStars: number | null;
  newsMentions: number;
  providerAvgBenchmark: number | null;
  releaseDate: string | null;
  isOpenWeights: boolean;
}

export interface ExpertNormStats {
  maxLikes: number;
  maxStars: number;
  maxNewsMentions: number;
}


export function computeExpertNormStats(
  models: Array<{ hfLikes: number; githubStars: number; newsMentions: number }>
): ExpertNormStats {
  let maxLikes = 1, maxStars = 1, maxNewsMentions = 1;
  for (const m of models) {
    if (m.hfLikes > maxLikes) maxLikes = m.hfLikes;
    if (m.githubStars > maxStars) maxStars = m.githubStars;
    if (m.newsMentions > maxNewsMentions) maxNewsMentions = m.newsMentions;
  }
  return { maxLikes, maxStars, maxNewsMentions };
}

/**
 * Compute expert consensus score for a single model.
 *
 * Coverage penalty (discrete steps):
 *   0 evidence signals -> 0 (unranked)
 *   1 -> 0.40, 2 -> 0.65, 3 -> 0.85, 4+ -> 1.00
 */
export function computeExpertScore(
  inputs: ExpertInputs,
  stats: ExpertNormStats
): number {
  let benchScore = 0;
  if (inputs.benchmarkScores && inputs.benchmarkScores.length > 0) {
    benchScore = weightedBenchmarkAvg(inputs.benchmarkScores);
  } else if (inputs.avgBenchmarkScore != null && inputs.avgBenchmarkScore > 0) {
    benchScore = inputs.avgBenchmarkScore;
  }

  let eloNorm = 0;
  if (inputs.eloScore != null && inputs.eloScore > 0) {
    eloNorm = normalizeElo(inputs.eloScore);
  }

  const likesNorm = inputs.hfLikes ? logNormalizeSignal(inputs.hfLikes, stats.maxLikes) : 0;
  const starsNorm = inputs.githubStars ? logNormalizeSignal(inputs.githubStars, stats.maxStars) : 0;
  const newsNorm = inputs.newsMentions > 0 ? logNormalizeSignal(inputs.newsMentions, stats.maxNewsMentions) : 0;

  const communityParts: number[] = [];
  if (likesNorm > 0) communityParts.push(likesNorm);
  if (starsNorm > 0) communityParts.push(starsNorm);
  if (newsNorm > 0) communityParts.push(newsNorm);
  const communitySignal = communityParts.length > 0
    ? communityParts.reduce((a, b) => a + b, 0) / communityParts.length
    : 0;

  let citationProxy = 0;
  if (inputs.providerAvgBenchmark != null && inputs.providerAvgBenchmark > 0) {
    citationProxy = Math.min(inputs.providerAvgBenchmark / 80 * 100, 100);
  }

  const recency = computeRecencyScore(inputs.releaseDate, { halfLifeMonths: 12 });

  let bWeight = 0.35, eWeight = 0.25;
  const cWeight = 0.20, ciWeight = 0.10, rWeight = 0.10;

  if (benchScore <= 0 && eloNorm > 0) { eWeight += bWeight; bWeight = 0; }
  if (eloNorm <= 0 && benchScore > 0) { bWeight += eWeight; eWeight = 0; }

  const rawScore = benchScore * bWeight + eloNorm * eWeight
                 + communitySignal * cWeight + citationProxy * ciWeight
                 + recency * rWeight;

  let evidenceCount = 0;
  if (benchScore > 0) evidenceCount++;
  if (eloNorm > 0) evidenceCount++;
  if (communitySignal > 0) evidenceCount++;
  if (citationProxy > 0) evidenceCount++;

  if (evidenceCount === 0) return 0;
  const penalty = getCoveragePenalty(EVIDENCE_COVERAGE_PENALTY, evidenceCount);

  const score = rawScore * penalty;
  return Math.round(Math.min(Math.max(score, 0), 100) * 10) / 10;
}
