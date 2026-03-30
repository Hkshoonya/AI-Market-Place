import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PriceComparison } from "@/components/charts/price-comparison";
import { formatTokenPrice } from "@/lib/format";
import type { RankedAccessOffer } from "@/lib/models/access-offers";
import { ExternalLink } from "lucide-react";
import {
  formatVerifiedPricingEntry,
  getCheapestVerifiedPricing,
  getOfficialPricing,
  getPricingAgeDays,
  getPrimaryPricingSignal,
  getStaleTrackedPricingEntries,
  getTrackedPricingEntries,
  isFreshVerifiedPricingEntry,
  isOfficialPricingProvider,
} from "@/lib/models/pricing";

export interface PricingEntry {
  provider_name: string;
  input_price_per_million: number | null;
  output_price_per_million: number | null;
  price_per_call?: number | null;
  price_per_gpu_second?: number | null;
  subscription_monthly?: number | null;
  median_output_tokens_per_second: number | null;
  median_time_to_first_token: number | null;
  source?: string | null;
  pricing_model?: string | null;
  currency?: string | null;
  effective_date?: string | null;
  updated_at?: string | null;
}

export interface PricingTabProps {
  pricingData: PricingEntry[];
  modelProvider: string;
  accessOffers?: RankedAccessOffer[];
}

function isDirectProvider(modelProvider: string, providerName: string): boolean {
  return isOfficialPricingProvider(modelProvider, providerName);
}

function getNumericPrice(value: number | null): number {
  return value == null ? Number.MAX_SAFE_INTEGER : value;
}

export function PricingTab({ pricingData, modelProvider, accessOffers = [] }: PricingTabProps) {
  const trackedPricing = getTrackedPricingEntries({
    id: "model-pricing",
    name: "pricing",
    slug: "pricing",
    provider: modelProvider,
    overall_rank: null,
    model_pricing: pricingData,
  });
  const staleTrackedPricing = getStaleTrackedPricingEntries({
    id: "model-pricing",
    name: "pricing",
    slug: "pricing",
    provider: modelProvider,
    overall_rank: null,
    model_pricing: pricingData,
  });
  const freshPricing = trackedPricing.filter((pricing) =>
    isFreshVerifiedPricingEntry(pricing)
  );

  const sortedPricing = [...trackedPricing].sort((left, right) => {
    const freshnessDelta =
      Number(isFreshVerifiedPricingEntry(right)) - Number(isFreshVerifiedPricingEntry(left));
    if (freshnessDelta !== 0) return freshnessDelta;

    const directDelta =
      Number(isDirectProvider(modelProvider, right.provider_name)) -
      Number(isDirectProvider(modelProvider, left.provider_name));
    if (directDelta !== 0) return directDelta;

    return (
      getNumericPrice(getPrimaryPricingSignal(left)?.amount ?? null) -
      getNumericPrice(getPrimaryPricingSignal(right)?.amount ?? null)
    );
  });

  const cheapestPricing = getCheapestVerifiedPricing({
    id: "model-pricing",
    name: "pricing",
    slug: "pricing",
    provider: modelProvider,
    overall_rank: null,
    model_pricing: pricingData,
  });
  const officialPricing = getOfficialPricing({
    id: "model-pricing",
    name: "pricing",
    slug: "pricing",
    provider: modelProvider,
    overall_rank: null,
    model_pricing: pricingData,
  });
  const cheapestProviderName = cheapestPricing?.provider_name ?? null;
  const tokenPricingRows = sortedPricing.filter(
    (pricing) => pricing.input_price_per_million != null
  );

  return (
      <Card className="border-border/50">
        <CardHeader>
        <CardTitle className="text-lg">Pricing and Ways to Use It</CardTitle>
        </CardHeader>
      <CardContent>
        <p className="mb-6 text-sm text-muted-foreground">
          Start with the simple view: the cheapest reliable option, the official provider price,
          and the best places to try or deploy this model. The detailed table stays below if you
          want the full pricing breakdown.
        </p>
        {tokenPricingRows.length > 1 && (
          <div className="mb-6">
            <PriceComparison
              models={tokenPricingRows.map((p) => ({
                name: p.provider_name,
                inputPrice: p.input_price_per_million ?? null,
                outputPrice: p.output_price_per_million ?? null,
              }))}
            />
          </div>
        )}
        {sortedPricing.length > 0 ? (
          <>
            <div className="mb-6 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Cheapest Trusted Option</div>
                <div className="mt-2 text-sm font-semibold">
                  {cheapestPricing
                    ? `${cheapestPricing.provider_name} · ${formatVerifiedPricingEntry(cheapestPricing) ?? "---"}`
                    : "Not available yet"}
                </div>
              </div>
              <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Official Provider Price</div>
                <div className="mt-2 text-sm font-semibold">
                  {officialPricing
                    ? `${officialPricing.provider_name} · ${formatVerifiedPricingEntry(officialPricing) ?? "---"}`
                    : "No direct first-party price tracked"}
                </div>
              </div>
              <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Fresh Price Checks</div>
                <div className="mt-2 text-sm font-semibold">{freshPricing.length}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  We only count recently verified prices here. Older tracked prices stay visible below,
                  but they are marked as older context instead of current truth.
                </div>
              </div>
            </div>
            {accessOffers.length > 0 ? (
              <div className="mb-6 grid gap-3 md:grid-cols-3">
                {accessOffers.slice(0, 3).map((offer) => (
                  <div
                    key={offer.platform.id}
                    className="rounded-xl border border-border/50 bg-card/40 p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold">{offer.platform.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {offer.bestFor}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {offer.label}
                      </Badge>
                    </div>
                    <div className="mt-4 text-sm font-semibold">
                      {offer.monthlyPriceLabel}
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {offer.actionLabel} · Value {offer.userValueScore.toFixed(0)} · Trust {offer.trustScore.toFixed(0)}
                    </div>
                    <a
                      href={offer.actionUrl}
                      target="_blank"
                      rel={offer.partnerDisclosure ? "noopener sponsored" : "noopener noreferrer"}
                      className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-neon hover:underline"
                    >
                      {offer.actionLabel}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    {offer.partnerDisclosure ? (
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {offer.partnerDisclosure}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
            <p className="mb-4 text-xs text-muted-foreground">
              Official provider access is separated from brokers and routers, so the lowest price does not
              get confused with the first-party route.
            </p>
            {staleTrackedPricing.length > 0 ? (
              <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-muted-foreground">
                {staleTrackedPricing.length} tracked price
                {staleTrackedPricing.length === 1 ? "" : "s"} need refresh. They are shown below for context,
                but they are excluded from the summary cards until re-verified.
              </div>
            ) : null}
            <div className="overflow-hidden rounded-lg border border-border/50">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50 bg-secondary/30">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      Provider
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-medium text-muted-foreground sm:table-cell">
                      Access
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                      Primary Price
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                      Output $/M
                    </th>
                    <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground sm:table-cell">
                      Speed
                    </th>
                    <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground md:table-cell">
                      TTFT
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPricing.map((pricing, index) => {
                    const isDirect = isDirectProvider(modelProvider, pricing.provider_name);
                    const isCheapest = pricing.provider_name === cheapestProviderName;
                    const isFresh = isFreshVerifiedPricingEntry(pricing);
                    const ageDays = getPricingAgeDays(pricing);

                    return (
                      <tr
                        key={`${pricing.provider_name}-${index}`}
                        className={`border-b border-border/30 ${isDirect && isFresh ? "bg-neon/5" : ""} ${!isFresh ? "bg-amber-500/5" : ""}`}
                      >
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium">{pricing.provider_name}</span>
                          {isDirect && (
                            <Badge className="ml-2 bg-neon/10 text-[10px] text-neon">
                              Official
                            </Badge>
                          )}
                          {isCheapest && (
                            <Badge className="ml-2 bg-gain/10 text-[10px] text-gain">
                              Best priced
                            </Badge>
                          )}
                          {!isFresh && (
                            <Badge className="ml-2 bg-amber-500/10 text-[10px] text-amber-500">
                              Stale
                            </Badge>
                          )}
                          {pricing.source && (
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              Source: {pricing.source}
                              {!isFresh && ageDays != null ? ` · ${ageDays}d old` : ""}
                            </div>
                          )}
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <Badge variant="outline" className="text-[10px]">
                            {isDirect ? "Direct" : "Broker / Router"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums">
                          {formatVerifiedPricingEntry(pricing) ?? "---"}
                        </td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums">
                          {pricing.output_price_per_million != null
                            ? formatTokenPrice(pricing.output_price_per_million)
                            : "---"}
                        </td>
                        <td className="hidden px-4 py-3 text-right text-sm tabular-nums text-muted-foreground sm:table-cell">
                          {pricing.median_output_tokens_per_second
                            ? `${Number(pricing.median_output_tokens_per_second).toFixed(0)} tok/s`
                            : "---"}
                        </td>
                        <td className="hidden px-4 py-3 text-right text-sm tabular-nums text-muted-foreground md:table-cell">
                          {pricing.median_time_to_first_token
                            ? `${Number(pricing.median_time_to_first_token).toFixed(2)}s`
                            : "---"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="py-8 text-center text-muted-foreground">
            No pricing data available yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
