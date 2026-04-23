import { getCanonicalProviderName } from "@/lib/constants/providers";

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

export type PublicSourceTrustTier =
  | "official"
  | "trusted_catalog"
  | "community"
  | "wrapper";

export const LOW_TRUST_PUBLIC_SOURCE_TIERS = new Set<PublicSourceTrustTier>([
  "community",
  "wrapper",
]);

export interface PublicSourceTrustModel {
  slug?: string | null;
  provider?: string | null;
  hf_model_id?: string | null;
  website_url?: string | null;
  hf_downloads?: number | null;
  hf_likes?: number | null;
  hf_trending_score?: number | null;
  overall_rank?: number | null;
  quality_score?: number | null;
  capability_score?: number | null;
  popularity_score?: number | null;
  adoption_score?: number | null;
  economic_footprint_score?: number | null;
}

export function isPackagingVariantSlug(slug: string | null | undefined) {
  return /(?:^|-)(?:gguf|bf16|fp8|int4|int8|nvfp4|awq)(?:-|$)/i.test(
    String(slug ?? "")
  );
}

export function isWrapperVariantSlug(slug: string | null | undefined) {
  return (
    /(?:^|-)latest$/i.test(String(slug ?? "")) ||
    /(?:^|-)(?:preview|exp|experimental)(?:-|$)/i.test(String(slug ?? "")) ||
    /(?:^|-)(?:generate|image|video)-\d{3}(?:$|-)/i.test(String(slug ?? ""))
  );
}

export function getPublicSourceTrustTier(
  model: PublicSourceTrustModel
): PublicSourceTrustTier {
  if (OFFICIAL_PROVIDERS.has(getCanonicalProviderName(model.provider ?? ""))) {
    return "official";
  }

  if (isPackagingVariantSlug(model.slug) || isWrapperVariantSlug(model.slug)) {
    return "wrapper";
  }

  if (model.hf_model_id || model.website_url) {
    return "trusted_catalog";
  }

  return "community";
}

export function isLowTrustPublicSourceTier(tier: PublicSourceTrustTier) {
  return LOW_TRUST_PUBLIC_SOURCE_TIERS.has(tier);
}
