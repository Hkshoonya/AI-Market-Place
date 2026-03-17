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
    effective_date?: string | null;
    updated_at?: string | null;
  }> | null;
}

export interface VerifiedPricingEntry {
  provider_name: string;
  input_price_per_million: number;
  output_price_per_million?: number | null;
  median_output_tokens_per_second?: number | null;
  median_time_to_first_token?: number | null;
  source?: string | null;
  pricing_model?: string | null;
  currency?: string | null;
  effective_date?: string | null;
  updated_at?: string | null;
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
    | "stale_refresh_needed"
    | "unavailable";
}

export interface PublicPricingSummaryOptions {
  compactStrategy?: "cheapest_verified" | "official_first";
}

export const VERIFIED_PRICING_MAX_AGE_DAYS = 45;

function normalizeProvider(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

const PROVIDER_ALIASES: Record<string, string[]> = {
  anthropic: ["anthropic"],
  deepseek: ["deepseek"],
  google: ["google", "googleai", "gemini"],
  meta: ["meta", "metaai"],
  mistralai: ["mistral", "mistralai"],
  openai: ["openai"],
  xai: ["xai"],
};

export function isOfficialPricingProvider(
  modelProvider: string | null | undefined,
  providerName: string | null | undefined
): boolean {
  const normalizedModelProvider = normalizeProvider(modelProvider);
  const normalizedProviderName = normalizeProvider(providerName);

  if (!normalizedModelProvider || !normalizedProviderName) return false;

  const aliases =
    PROVIDER_ALIASES[normalizedModelProvider] ?? [normalizedModelProvider];

  return aliases.includes(normalizedProviderName);
}

function parsePricingDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getPricingReferenceDate(entry: VerifiedPricingEntry): Date | null {
  return parsePricingDate(entry.effective_date) ?? parsePricingDate(entry.updated_at);
}

export function getPricingAgeDays(
  entry: Pick<VerifiedPricingEntry, "effective_date" | "updated_at">,
  asOf: Date = new Date()
): number | null {
  const referenceDate = parsePricingDate(entry.effective_date) ?? parsePricingDate(entry.updated_at);
  if (!referenceDate) return null;

  const diffMs = asOf.getTime() - referenceDate.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return 0;
  return Math.floor(diffMs / 86_400_000);
}

export function isFreshVerifiedPricingEntry(
  entry: VerifiedPricingEntry,
  asOf: Date = new Date()
): boolean {
  const ageDays = getPricingAgeDays(entry, asOf);
  if (ageDays == null) return true;
  return ageDays <= VERIFIED_PRICING_MAX_AGE_DAYS;
}

export function getTrackedPricingEntries(model: PriceSortableModel): VerifiedPricingEntry[] {
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

export function getVerifiedPricingEntries(
  model: PriceSortableModel,
  asOf: Date = new Date()
): VerifiedPricingEntry[] {
  return getTrackedPricingEntries(model).filter((pricing) =>
    isFreshVerifiedPricingEntry(pricing, asOf)
  );
}

export function getStaleTrackedPricingEntries(
  model: PriceSortableModel,
  asOf: Date = new Date()
): VerifiedPricingEntry[] {
  return getTrackedPricingEntries(model).filter(
    (pricing) => !isFreshVerifiedPricingEntry(pricing, asOf)
  );
}

export function getCheapestVerifiedPricing(
  model: PriceSortableModel,
  asOf: Date = new Date()
): VerifiedPricingEntry | null {
  const prices = [...getVerifiedPricingEntries(model, asOf)].sort(
    (left, right) => left.input_price_per_million - right.input_price_per_million
  );

  return prices[0] ?? null;
}

export function getOfficialPricing(
  model: PriceSortableModel,
  asOf: Date = new Date()
): VerifiedPricingEntry | null {
  const directEntries = getVerifiedPricingEntries(model, asOf)
    .filter((pricing) => isOfficialPricingProvider(model.provider, pricing.provider_name))
    .sort((left, right) => left.input_price_per_million - right.input_price_per_million);

  return directEntries[0] ?? null;
}

export function getPublicPricingSummary(
  model: PriceSortableModel,
  options: PublicPricingSummaryOptions = {}
): PublicPricingSummary {
  const asOf = new Date();
  const official = getOfficialPricing(model, asOf);
  const cheapestVerifiedRoute = getCheapestVerifiedPricing(model, asOf);
  const staleTrackedPricing = getStaleTrackedPricingEntries(model, asOf)
    .sort((left, right) => {
      const leftDate = getPricingReferenceDate(left)?.getTime() ?? 0;
      const rightDate = getPricingReferenceDate(right)?.getTime() ?? 0;
      return rightDate - leftDate;
    });
  const compactStrategy = options.compactStrategy ?? "cheapest_verified";

  if (compactStrategy === "official_first" && official) {
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
      compactLabel: "Cheapest verified",
      compactSourceLabel: cheapestVerifiedRoute.provider_name,
      strategy: "cheapest_verified_route",
    };
  }

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

  if (staleTrackedPricing.length > 0) {
    const freshestTracked = staleTrackedPricing[0];
    return {
      official,
      cheapestVerifiedRoute,
      compactEntry: null,
      compactPrice: null,
      compactLabel: "Needs refresh",
      compactSourceLabel: freshestTracked.provider_name,
      strategy: "stale_refresh_needed",
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
