export interface PriceSortableModel {
  id: string;
  name: string;
  slug: string;
  provider?: string | null;
  overall_rank: number | null;
  is_open_weights?: boolean | null;
  model_pricing?: Array<{
    provider_name?: string | null;
    input_price_per_million?: number | null;
    output_price_per_million?: number | null;
    source?: string | null;
    pricing_model?: string | null;
    currency?: string | null;
  }> | null;
}

export interface VerifiedPricingEntry {
  provider_name: string;
  input_price_per_million: number;
  output_price_per_million?: number | null;
  source?: string | null;
  pricing_model?: string | null;
  currency?: string | null;
}

function normalizeProvider(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isOfficialPricingProvider(
  modelProvider: string | null | undefined,
  providerName: string | null | undefined
): boolean {
  const normalizedModelProvider = normalizeProvider(modelProvider);
  const normalizedProviderName = normalizeProvider(providerName);

  if (!normalizedModelProvider || !normalizedProviderName) return false;

  return (
    normalizedProviderName.includes(normalizedModelProvider) ||
    normalizedModelProvider.includes(normalizedProviderName)
  );
}

export function getVerifiedPricingEntries(model: PriceSortableModel): VerifiedPricingEntry[] {
  return (
    model.model_pricing?.filter((pricing): pricing is VerifiedPricingEntry => {
      if (!pricing.provider_name) return false;
      if (pricing.currency && pricing.currency !== "USD") return false;
      if (pricing.input_price_per_million == null) return false;
      if (typeof pricing.input_price_per_million !== "number") return false;
      if (!Number.isFinite(pricing.input_price_per_million)) return false;
      return pricing.input_price_per_million >= 0;
    }) ?? []
  );
}

export function getCheapestVerifiedPricing(
  model: PriceSortableModel
): VerifiedPricingEntry | null {
  const prices = [...getVerifiedPricingEntries(model)].sort(
    (left, right) => left.input_price_per_million - right.input_price_per_million
  );

  return prices[0] ?? null;
}

export function getOfficialPricing(
  model: PriceSortableModel
): VerifiedPricingEntry | null {
  const directEntries = getVerifiedPricingEntries(model)
    .filter((pricing) => isOfficialPricingProvider(model.provider, pricing.provider_name))
    .sort((left, right) => left.input_price_per_million - right.input_price_per_million);

  return directEntries[0] ?? null;
}

export function getLowestInputPrice(model: PriceSortableModel): number | null {
  const cheapestVerified = getCheapestVerifiedPricing(model);

  if (cheapestVerified) {
    return cheapestVerified.input_price_per_million;
  }

  return model.is_open_weights ? 0 : null;
}

export function compareModelsByLowestPrice(
  left: PriceSortableModel,
  right: PriceSortableModel
): number {
  const leftPrice = getLowestInputPrice(left);
  const rightPrice = getLowestInputPrice(right);

  if (leftPrice == null && rightPrice == null) {
    const leftRank = left.overall_rank ?? Number.MAX_SAFE_INTEGER;
    const rightRank = right.overall_rank ?? Number.MAX_SAFE_INTEGER;
    return leftRank - rightRank;
  }

  if (leftPrice == null) return 1;
  if (rightPrice == null) return -1;
  if (leftPrice !== rightPrice) return leftPrice - rightPrice;

  const leftRank = left.overall_rank ?? Number.MAX_SAFE_INTEGER;
  const rightRank = right.overall_rank ?? Number.MAX_SAFE_INTEGER;
  return leftRank - rightRank;
}
