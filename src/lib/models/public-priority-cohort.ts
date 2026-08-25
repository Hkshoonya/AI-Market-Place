import {
  dedupePublicModelFamilies,
  type PublicModelFamilyCandidate,
} from "./public-families";
import { isDefaultPublicSurfaceReady } from "./public-surface-readiness";

export const DEFAULT_PUBLIC_PRIORITY_MODEL_LIMIT = 300;

export interface PublicPriorityModelCandidate
  extends PublicModelFamilyCandidate {
  architecture?: string | null;
  hf_model_id?: string | null;
  website_url?: string | null;
  license?: string | null;
  license_name?: string | null;
}

export function buildPublicPriorityModelCohort<
  T extends PublicPriorityModelCandidate,
>(
  activeModels: T[],
  limit = DEFAULT_PUBLIC_PRIORITY_MODEL_LIMIT
): T[] {
  return dedupePublicModelFamilies(activeModels)
    .filter(isDefaultPublicSurfaceReady)
    .sort((left, right) => {
      const rankDifference =
        Number(left.overall_rank ?? Number.MAX_SAFE_INTEGER) -
        Number(right.overall_rank ?? Number.MAX_SAFE_INTEGER);
      if (rankDifference !== 0) return rankDifference;

      const qualityDifference =
        Number(right.quality_score ?? 0) - Number(left.quality_score ?? 0);
      if (qualityDifference !== 0) return qualityDifference;

      return Number(right.hf_downloads ?? 0) - Number(left.hf_downloads ?? 0);
    })
    .slice(0, Math.max(0, limit));
}
