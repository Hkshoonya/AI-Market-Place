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
    price_per_call?: number | null;
    price_per_gpu_second?: number | null;
    subscription_monthly?: number | null;
    source?: string | null;
    pricing_model?: string | null;
    currency?: string | null;
    effective_date?: string | null;
    updated_at?: string | null;
  }> | null;
}

export interface VerifiedPricingEntry {
  provider_name: string;
  input_price_per_million?: number | null;
  output_price_per_million?: number | null;
  price_per_call?: number | null;
  price_per_gpu_second?: number | null;
  subscription_monthly?: number | null;
  median_output_tokens_per_second?: number | null;
  median_time_to_first_token?: number | null;
  source?: string | null;
  pricing_model?: string | null;
  currency?: string | null;
  effective_date?: string | null;
  updated_at?: string | null;
}

export type CompactPricingKind =
  | "token"
  | "request"
  | "gpu_second"
  | "monthly";

export interface CompactPricingSignal {
  amount: number;
  kind: CompactPricingKind;
  suffix: string;
}

export interface PublicPricingSummary {
  official: VerifiedPricingEntry | null;
  cheapestVerifiedRoute: VerifiedPricingEntry | null;
  compactEntry: VerifiedPricingEntry | null;
  compactPrice: number | null;
  compactKind: CompactPricingKind | null;
  compactSuffix: string | null;
  compactDisplay: string | null;
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
      return getPrimaryPricingSignal(pricing) != null;
    }) ?? []
  );
}

export function getPrimaryPricingSignal(
  entry: Pick<
    VerifiedPricingEntry,
    | "input_price_per_million"
    | "price_per_call"
    | "price_per_gpu_second"
    | "subscription_monthly"
  >
): CompactPricingSignal | null {
  const tokenPrice = entry.input_price_per_million;
  if (typeof tokenPrice === "number" && Number.isFinite(tokenPrice) && tokenPrice >= 0) {
    return { amount: tokenPrice, kind: "token", suffix: "/M" };
  }

  const requestPrice = entry.price_per_call;
  if (typeof requestPrice === "number" && Number.isFinite(requestPrice) && requestPrice >= 0) {
    return { amount: requestPrice, kind: "request", suffix: "/request" };
  }

  const gpuSecondPrice = entry.price_per_gpu_second;
  if (typeof gpuSecondPrice === "number" && Number.isFinite(gpuSecondPrice) && gpuSecondPrice >= 0) {
    return { amount: gpuSecondPrice, kind: "gpu_second", suffix: "/GPU-s" };
  }

  const monthlyPrice = entry.subscription_monthly;
  if (typeof monthlyPrice === "number" && Number.isFinite(monthlyPrice) && monthlyPrice >= 0) {
    return { amount: monthlyPrice, kind: "monthly", suffix: "/mo" };
  }

  return null;
}

function comparePrimaryPricingSignals(
  left: VerifiedPricingEntry,
  right: VerifiedPricingEntry
): number {
  const leftSignal = getPrimaryPricingSignal(left);
  const rightSignal = getPrimaryPricingSignal(right);
  if (!leftSignal && !rightSignal) return 0;
  if (!leftSignal) return 1;
  if (!rightSignal) return -1;

  const kindOrder: Record<CompactPricingKind, number> = {
    token: 0,
    request: 1,
    gpu_second: 2,
    monthly: 3,
  };

  if (leftSignal.kind !== rightSignal.kind) {
    return kindOrder[leftSignal.kind] - kindOrder[rightSignal.kind];
  }

  return leftSignal.amount - rightSignal.amount;
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
  const prices = [...getVerifiedPricingEntries(model, asOf)].sort(comparePrimaryPricingSignals);

  return prices[0] ?? null;
}

export function getOfficialPricing(
  model: PriceSortableModel,
  asOf: Date = new Date()
): VerifiedPricingEntry | null {
  const directEntries = getVerifiedPricingEntries(model, asOf)
    .filter((pricing) => isOfficialPricingProvider(model.provider, pricing.provider_name))
    .sort(comparePrimaryPricingSignals);

  return directEntries[0] ?? null;
}

export function formatCompactPricingSignal(
  signal: Pick<PublicPricingSummary, "compactPrice" | "compactKind" | "compactSuffix">
): string | null {
  if (signal.compactPrice == null || signal.compactKind == null || signal.compactSuffix == null) {
    return null;
  }

  if (signal.compactPrice === 0) return "Free";
  return `$${Number(signal.compactPrice).toFixed(signal.compactPrice < 1 ? 4 : 2)}${signal.compactSuffix}`;
}

export function formatVerifiedPricingEntry(entry: VerifiedPricingEntry): string | null {
  const signal = getPrimaryPricingSignal(entry);
  if (!signal) return null;
  return formatCompactPricingSignal({
    compactPrice: signal.amount,
    compactKind: signal.kind,
    compactSuffix: signal.suffix,
  });
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
    const officialSignal = getPrimaryPricingSignal(official);
    return {
      official,
      cheapestVerifiedRoute,
      compactEntry: official,
      compactPrice: officialSignal?.amount ?? null,
      compactKind: officialSignal?.kind ?? null,
      compactSuffix: officialSignal?.suffix ?? null,
      compactDisplay: officialSignal
        ? formatCompactPricingSignal({
            compactPrice: officialSignal.amount,
            compactKind: officialSignal.kind,
            compactSuffix: officialSignal.suffix,
          })
        : null,
      compactLabel: "Official",
      compactSourceLabel: official.provider_name,
      strategy: "official_company_price",
    };
  }

  if (cheapestVerifiedRoute) {
    const cheapestSignal = getPrimaryPricingSignal(cheapestVerifiedRoute);
    return {
      official,
      cheapestVerifiedRoute,
      compactEntry: cheapestVerifiedRoute,
      compactPrice: cheapestSignal?.amount ?? null,
      compactKind: cheapestSignal?.kind ?? null,
      compactSuffix: cheapestSignal?.suffix ?? null,
      compactDisplay: cheapestSignal
        ? formatCompactPricingSignal({
            compactPrice: cheapestSignal.amount,
            compactKind: cheapestSignal.kind,
            compactSuffix: cheapestSignal.suffix,
          })
        : null,
      compactLabel: "Cheapest verified",
      compactSourceLabel: cheapestVerifiedRoute.provider_name,
      strategy: "cheapest_verified_route",
    };
  }

  if (official) {
    const officialSignal = getPrimaryPricingSignal(official);
    return {
      official,
      cheapestVerifiedRoute,
      compactEntry: official,
      compactPrice: officialSignal?.amount ?? null,
      compactKind: officialSignal?.kind ?? null,
      compactSuffix: officialSignal?.suffix ?? null,
      compactDisplay: officialSignal
        ? formatCompactPricingSignal({
            compactPrice: officialSignal.amount,
            compactKind: officialSignal.kind,
            compactSuffix: officialSignal.suffix,
          })
        : null,
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
      compactKind: "token",
      compactSuffix: "/M",
      compactDisplay: "Free",
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
      compactKind: null,
      compactSuffix: null,
      compactDisplay: null,
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
    compactKind: null,
    compactSuffix: null,
    compactDisplay: null,
    compactLabel: "Unavailable",
    compactSourceLabel: "No verified price",
    strategy: "unavailable",
  };
}

export function getLowestInputPrice(model: PriceSortableModel): number | null {
  return getCheapestVerifiedPricing(model)?.input_price_per_million ?? (model.is_open_weights ? 0 : null);
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
