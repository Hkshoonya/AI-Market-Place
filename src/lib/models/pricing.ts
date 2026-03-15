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

export interface PublicPricingSummary {
  official: VerifiedPricingEntry | null;
  cheapestVerifiedRoute: VerifiedPricingEntry | null;
  compactEntry: VerifiedPricingEntry | null;
  compactPrice: number | null;
  compactLabel: string;
  compactSourceLabel: string;
  strategy:
    | "official_company_price"
    | "cheapest_verified_route"
    | "open_weights_free"
    | "unavailable";
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

export function getPublicPricingSummary(
  model: PriceSortableModel
): PublicPricingSummary {
  const official = getOfficialPricing(model);
  const cheapestVerifiedRoute = getCheapestVerifiedPricing(model);

  if (official) {
    return {
      official,
      cheapestVerifiedRoute,
      compactEntry: official,
      compactPrice: official.input_price_per_million,
      compactLabel: "Official",
      compactSourceLabel: official.provider_name,
      strategy: "official_company_price",
    };
  }

  if (cheapestVerifiedRoute) {
    return {
      official,
      cheapestVerifiedRoute,
      compactEntry: cheapestVerifiedRoute,
      compactPrice: cheapestVerifiedRoute.input_price_per_million,
      compactLabel: "Cheapest route",
      compactSourceLabel: cheapestVerifiedRoute.provider_name,
      strategy: "cheapest_verified_route",
    };
  }

  if (model.is_open_weights) {
    return {
      official,
      cheapestVerifiedRoute,
      compactEntry: null,
      compactPrice: 0,
      compactLabel: "Free",
      compactSourceLabel: "Open weights",
      strategy: "open_weights_free",
    };
  }

  return {
    official,
    cheapestVerifiedRoute,
    compactEntry: null,
    compactPrice: null,
    compactLabel: "Unavailable",
    compactSourceLabel: "No verified price",
    strategy: "unavailable",
  };
}

export function getLowestInputPrice(model: PriceSortableModel): number | null {
  return getPublicPricingSummary(model).compactPrice;
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
