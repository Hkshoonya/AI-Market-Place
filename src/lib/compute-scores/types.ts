/**
 * Compute Scores Pipeline — Type Contracts
 *
 * Defines the data contracts between pipeline stages:
 *   fetchInputs()      -> ScoringInputs
 *   computeAllLenses() -> ScoringResults
 *   persistResults()   -> PersistStats
 */

import type { NormalizationStats } from "@/lib/scoring/quality-calculator";

export interface ScoringInputs {
  models: Array<{
    id: string;
    name: string;
    slug: string;
    provider: string;
    category: string;
    quality_score: number | null;
    value_score: number | null;
    hf_downloads: number | null;
    hf_likes: number | null;
    release_date: string | null;
    is_open_weights: boolean;
    hf_trending_score: number | null;
    parameter_count: number | null;
    github_stars: number | null;
  }>;
  benchmarkMap: Map<string, number[]>;
  benchmarkDetailMap: Map<string, Array<{ slug: string; score: number }>>;
  eloMap: Map<string, number>;
  newsMentionMap: Map<string, number>;
  providerBenchmarkAvg: Map<string, number>;
  staleCount: number;
}

export interface ScoringResults {
  scoredModels: Array<{ id: string; category: string; qualityScore: number }>;
  capabilityScoreMap: Map<string, number | null>;
  capRankMap: Map<string, number>;
  usageScoreMap: Map<string, number>;
  usageRankMap: Map<string, number>;
  expertScoreMap: Map<string, number>;
  expertRankMap: Map<string, number>;
  balancedRankings: Array<{ id: string; balanced_rank: number; category_balanced_rank: number }>;
  balancedRankMap: Map<string, { overall: number; category: number }>;
  agentScoreMap: Map<string, number>;
  agentRankMap: Map<string, number>;
  popularityMap: Map<string, number>;
  popRankMap: Map<string, number>;
  marketCapMap: Map<string, number>;
  cheapestPriceMap: Map<string, number>;
  normalizedValueMap: Map<string, number>;
  valueRankMap: Map<string, number>;
  pricingSynced: number;
  stats: NormalizationStats;
}

export interface PersistStats {
  updated: number;
  errors: number;
  snapshotsCreated: number;
}
