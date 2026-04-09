import {
  getPublicSourceTrustTier,
  isPackagingVariantSlug,
  isWrapperVariantSlug,
} from "./public-source-trust";

export { OFFICIAL_PROVIDERS } from "./public-source-trust";

export interface PublicSurfaceReadinessModel {
  slug?: string | null;
  provider?: string | null;
  hf_model_id?: string | null;
  website_url?: string | null;
  name?: string | null;
  category?: string | null;
  release_date?: string | null;
  is_open_weights?: boolean | null;
  license?: string | null;
  license_name?: string | null;
  context_window?: number | null;
  overall_rank?: number | null;
  capability_score?: number | null;
  quality_score?: number | null;
  adoption_score?: number | null;
  popularity_score?: number | null;
  economic_footprint_score?: number | null;
  hf_downloads?: number | null;
  hf_likes?: number | null;
  hf_trending_score?: number | null;
}

export type PublicSurfaceReadinessBlocker =
  | "missing_name"
  | "missing_category"
  | "missing_release_date"
  | "missing_open_weight_license"
  | "missing_context_window"
  | "packaging_variant"
  | "wrapper_variant"
  | "weak_signals";

export function needsContextWindow(model: Pick<PublicSurfaceReadinessModel, "category">) {
  return model.category === "llm" || model.category === "multimodal";
}

export function isPackagingVariantModel(
  model: Pick<PublicSurfaceReadinessModel, "slug">
) {
  return isPackagingVariantSlug(model.slug);
}

export function isReleaseDateWrapperModel(
  model: Pick<PublicSurfaceReadinessModel, "slug">
) {
  return isWrapperVariantSlug(model.slug);
}

export function needsContextWindowForCoverage(model: PublicSurfaceReadinessModel) {
  return needsContextWindow(model) && !isPackagingVariantModel(model);
}

export function hasOpenWeightLicense(
  model: Pick<PublicSurfaceReadinessModel, "license" | "license_name">
) {
  return Boolean(model.license_name || model.license);
}

export function hasDiscoveryMetadata(model: PublicSurfaceReadinessModel) {
  return Boolean(
    model.name?.trim() &&
      model.category &&
      (model.release_date || isReleaseDateWrapperModel(model))
  );
}

export function hasCompletePublicMetadata(model: PublicSurfaceReadinessModel) {
  return (
    hasDiscoveryMetadata(model) &&
    (!Boolean(model.is_open_weights) || hasOpenWeightLicense(model)) &&
    (!needsContextWindowForCoverage(model) || Boolean(model.context_window))
  );
}

export function hasMeaningfulPublicSignals(model: PublicSurfaceReadinessModel) {
  if (
    Number(model.capability_score ?? 0) > 0 ||
    Number(model.quality_score ?? 0) > 0 ||
    Number(model.adoption_score ?? 0) > 0 ||
    Number(model.popularity_score ?? 0) > 0 ||
    Number(model.economic_footprint_score ?? 0) > 0
  ) {
    return true;
  }

  if (Number(model.overall_rank ?? 0) > 0) return true;
  if (Number(model.hf_downloads ?? 0) > 0) return true;
  if (Number(model.hf_likes ?? 0) > 0) return true;
  if (Number(model.hf_trending_score ?? 0) > 0) return true;

  return false;
}

export function getDefaultPublicSurfaceReadinessBlockers(
  model: PublicSurfaceReadinessModel
): PublicSurfaceReadinessBlocker[] {
  const blockers: PublicSurfaceReadinessBlocker[] = [];

  if (!model.name?.trim()) blockers.push("missing_name");
  if (!model.category) blockers.push("missing_category");
  if (!model.release_date && !isReleaseDateWrapperModel(model)) {
    blockers.push("missing_release_date");
  }
  if (Boolean(model.is_open_weights) && !hasOpenWeightLicense(model)) {
    blockers.push("missing_open_weight_license");
  }
  if (needsContextWindowForCoverage(model) && !Boolean(model.context_window)) {
    blockers.push("missing_context_window");
  }
  if (isPackagingVariantModel(model)) blockers.push("packaging_variant");
  if (isReleaseDateWrapperModel(model)) blockers.push("wrapper_variant");
  if (getPublicSourceTrustTier(model) === "community") {
    blockers.push("weak_signals");
  }

  return blockers;
}

export function isDefaultPublicSurfaceReady(model: PublicSurfaceReadinessModel) {
  return getDefaultPublicSurfaceReadinessBlockers(model).length === 0;
}

export function preferDefaultPublicSurfaceReady<T extends PublicSurfaceReadinessModel>(
  models: T[],
  minimumCount: number
) {
  const ready = models.filter((model) =>
    typeof model.slug === "string" &&
    model.slug.length > 0 &&
    isDefaultPublicSurfaceReady(model)
  );

  return ready.length >= minimumCount ? ready : models;
}
