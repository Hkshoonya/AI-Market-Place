export const OFFICIAL_PROVIDERS = new Set([
  "OpenAI",
  "Anthropic",
  "Google",
  "xAI",
  "Z.ai",
  "MiniMax",
  "Microsoft",
  "NVIDIA",
  "Meta",
  "Mistral AI",
  "Moonshot AI",
  "Qwen",
  "DeepSeek",
  "Black Forest Labs",
  "Cohere",
  "Amazon",
  "Alibaba",
  "Bytedance",
]);

export interface PublicSurfaceReadinessModel {
  slug: string;
  provider?: string | null;
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

export function needsContextWindow(model: Pick<PublicSurfaceReadinessModel, "category">) {
  return model.category === "llm" || model.category === "multimodal";
}

export function isPackagingVariantModel(
  model: Pick<PublicSurfaceReadinessModel, "slug">
) {
  return /(?:^|-)(?:gguf|bf16|fp8|int4|int8|nvfp4|awq)(?:-|$)/i.test(
    model.slug
  );
}

export function isReleaseDateWrapperModel(
  model: Pick<PublicSurfaceReadinessModel, "slug">
) {
  return (
    /(?:^|-)latest$/i.test(model.slug) ||
    /(?:^|-)(?:preview|exp|experimental)(?:-|$)/i.test(model.slug) ||
    /(?:^|-)(?:generate|image|video)-\d{3}(?:$|-)/i.test(model.slug)
  );
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

export function isDefaultPublicSurfaceReady(model: PublicSurfaceReadinessModel) {
  if (!hasCompletePublicMetadata(model)) return false;
  if (isPackagingVariantModel(model) || isReleaseDateWrapperModel(model)) return false;

  return (
    OFFICIAL_PROVIDERS.has(model.provider ?? "") || hasMeaningfulPublicSignals(model)
  );
}
