import {
  POPULARITY_COVERAGE_PENALTY,
  getCoveragePenalty,
} from "@/lib/constants/scoring";
import { addSignal, logNormalizeSignal } from "@/lib/scoring/scoring-helpers";

export interface PopularityInputs {
  downloads: number;
  likes: number;
  stars: number;
  newsMentions: number;
  providerUsageEstimate: number;
  trendingScore: number;
  releaseDate: string | null;
}

export interface PopularityStats {
  maxDownloads: number;
  maxLikes: number;
  maxStars: number;
  maxNewsMentions: number;
  maxUsageEstimate: number;
  maxTrendingScore: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function computeDurabilityScore(releaseDate: string | null): number {
  if (!releaseDate) return 45;

  const releaseTimestamp = Date.parse(releaseDate);
  if (!Number.isFinite(releaseTimestamp)) return 45;

  const ageMs = Date.now() - releaseTimestamp;
  const ageMonths = ageMs / (1000 * 60 * 60 * 24 * 30.4375);

  if (ageMonths <= 0) return 40;

  return clamp(35 + Math.min(ageMonths / 24, 1) * 65, 40, 100);
}

export function computePopularityStats(models: PopularityInputs[]): PopularityStats {
  let maxDownloads = 1;
  let maxLikes = 1;
  let maxStars = 1;
  let maxNewsMentions = 1;
  let maxUsageEstimate = 1;
  let maxTrendingScore = 1;

  for (const model of models) {
    if (model.downloads > maxDownloads) maxDownloads = model.downloads;
    if (model.likes > maxLikes) maxLikes = model.likes;
    if (model.stars > maxStars) maxStars = model.stars;
    if (model.newsMentions > maxNewsMentions) maxNewsMentions = model.newsMentions;
    if (model.providerUsageEstimate > maxUsageEstimate) maxUsageEstimate = model.providerUsageEstimate;
    if (model.trendingScore > maxTrendingScore) maxTrendingScore = model.trendingScore;
  }

  return {
    maxDownloads,
    maxLikes,
    maxStars,
    maxNewsMentions,
    maxUsageEstimate,
    maxTrendingScore,
  };
}

export function computePopularityScore(
  inputs: PopularityInputs,
  stats: PopularityStats
): number {
  const signals: Array<{ name: string; score: number; weight: number }> = [];
  let evidenceSignalCount = 0;

  const communitySignals: number[] = [];
  if (inputs.downloads > 0 && stats.maxDownloads > 0) {
    communitySignals.push(logNormalizeSignal(inputs.downloads, stats.maxDownloads));
  }
  if (inputs.likes > 0 && stats.maxLikes > 0) {
    communitySignals.push(logNormalizeSignal(inputs.likes, stats.maxLikes));
  }
  if (inputs.stars > 0 && stats.maxStars > 0) {
    communitySignals.push(logNormalizeSignal(inputs.stars, stats.maxStars));
  }
  if (communitySignals.length > 0) {
    evidenceSignalCount++;
    addSignal(
      signals,
      "community",
      communitySignals.reduce((sum, score) => sum + score, 0) / communitySignals.length,
      0.4
    );
  }

  const marketSignals: number[] = [];
  if (inputs.newsMentions > 0 && stats.maxNewsMentions > 0) {
    marketSignals.push(logNormalizeSignal(inputs.newsMentions, stats.maxNewsMentions));
  }
  if (inputs.trendingScore > 0 && stats.maxTrendingScore > 0) {
    marketSignals.push((inputs.trendingScore / stats.maxTrendingScore) * 100);
  }
  if (marketSignals.length > 0) {
    evidenceSignalCount++;
    addSignal(
      signals,
      "market",
      marketSignals.reduce((sum, score) => sum + score, 0) / marketSignals.length,
      0.2
    );
  }

  if (inputs.providerUsageEstimate > 0 && stats.maxUsageEstimate > 0) {
    evidenceSignalCount++;
    addSignal(
      signals,
      "adoption",
      logNormalizeSignal(inputs.providerUsageEstimate, stats.maxUsageEstimate),
      0.25
    );
  }

  if (evidenceSignalCount === 0) return 0;

  addSignal(signals, "durability", computeDurabilityScore(inputs.releaseDate), 0.15);

  const totalWeight = signals.reduce((sum, signal) => sum + signal.weight, 0);
  const weightedSum = signals.reduce(
    (sum, signal) => sum + signal.score * (signal.weight / totalWeight),
    0
  );

  const coverageFactor = getCoveragePenalty(POPULARITY_COVERAGE_PENALTY, evidenceSignalCount);
  const adjustedScore = weightedSum * coverageFactor;

  return Math.round(Math.min(adjustedScore, 100) * 10) / 10;
}
