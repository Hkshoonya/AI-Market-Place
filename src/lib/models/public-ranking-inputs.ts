import type { PublicSurfaceReadinessModel } from "./public-surface-readiness";

export const MODEL_PUBLIC_RANKING_FIELDS = [
  "overall_rank",
  "popularity_score",
  "adoption_score",
  "quality_score",
  "value_score",
  "economic_footprint_score",
  "market_cap_estimate",
  "popularity_rank",
  "adoption_rank",
  "agent_score",
  "agent_rank",
  "capability_score",
  "capability_rank",
  "economic_footprint_rank",
  "usage_score",
  "usage_rank",
  "expert_score",
  "expert_rank",
  "balanced_rank",
  "hf_trending_score",
] as const;

export type PublicRankingInputRecord = PublicSurfaceReadinessModel & {
  value_score?: number | null;
  market_cap_estimate?: number | null;
  popularity_rank?: number | null;
  adoption_rank?: number | null;
  agent_score?: number | null;
  agent_rank?: number | null;
  capability_rank?: number | null;
  economic_footprint_rank?: number | null;
  usage_score?: number | null;
  usage_rank?: number | null;
  expert_score?: number | null;
  expert_rank?: number | null;
  balanced_rank?: number | null;
};

export function hasPublicRankingInputs(model: PublicRankingInputRecord) {
  return MODEL_PUBLIC_RANKING_FIELDS.some((field) => {
    const value = model[field];
    return typeof value === "number" && Number.isFinite(value);
  });
}

export function stripPublicRankingInputs<T extends Record<string, unknown>>(
  record: T
): T {
  const normalized: Record<string, unknown> = { ...record };
  for (const field of MODEL_PUBLIC_RANKING_FIELDS) {
    normalized[field] = null;
  }
  return normalized as T;
}
