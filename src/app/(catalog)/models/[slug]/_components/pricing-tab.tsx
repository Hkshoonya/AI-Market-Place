import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PriceComparison } from "@/components/charts/price-comparison";
import { formatTokenPrice } from "@/lib/format";
import { getCheapestVerifiedPricing, getOfficialPricing, isOfficialPricingProvider } from "@/lib/models/pricing";

export interface PricingEntry {
  provider_name: string;
  input_price_per_million: number | null;
  output_price_per_million: number | null;
  median_output_tokens_per_second: number | null;
  median_time_to_first_token: number | null;
  source?: string | null;
  pricing_model?: string | null;
  currency?: string | null;
}

export interface PricingTabProps {
  pricingData: PricingEntry[];
  modelProvider: string;
}

function isDirectProvider(modelProvider: string, providerName: string): boolean {
  return isOfficialPricingProvider(modelProvider, providerName);
}

function getNumericPrice(value: number | null): number {
  return value == null ? Number.MAX_SAFE_INTEGER : value;
}

export function PricingTab({ pricingData, modelProvider }: PricingTabProps) {
  const sortedPricing = [...pricingData].sort((left, right) => {
    const directDelta =
      Number(isDirectProvider(modelProvider, right.provider_name)) -
      Number(isDirectProvider(modelProvider, left.provider_name));
    if (directDelta !== 0) return directDelta;

    return getNumericPrice(left.input_price_per_million) - getNumericPrice(right.input_price_per_million);
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

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg">Pricing Across Providers</CardTitle>
      </CardHeader>
      <CardContent>
        {sortedPricing.length > 1 && (
          <div className="mb-6">
            <PriceComparison
              models={sortedPricing.map((p) => ({
                name: p.provider_name,
                inputPrice: p.input_price_per_million,
                outputPrice: p.output_price_per_million,
              }))}
            />
          </div>
        )}
        {sortedPricing.length > 0 ? (
          <>
            <div className="mb-6 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Cheapest Verified</div>
                <div className="mt-2 text-sm font-semibold">
                  {cheapestPricing
                    ? `${cheapestPricing.provider_name} · ${formatTokenPrice(cheapestPricing.input_price_per_million)} /M`
                    : "Not available yet"}
                </div>
              </div>
              <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Official First-Party</div>
                <div className="mt-2 text-sm font-semibold">
                  {officialPricing
                    ? `${officialPricing.provider_name} · ${formatTokenPrice(officialPricing.input_price_per_million)} /M`
                    : "No direct first-party price tracked"}
                </div>
              </div>
              <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Verified Routes</div>
                <div className="mt-2 text-sm font-semibold">{sortedPricing.length}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Cheapest price is shown in tables; this view separates direct and routed access.
                </div>
              </div>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">
              Direct first-party access is shown first. Brokers and routers are kept visible separately so
              the cheapest path does not get confused with the official one.
            </p>
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
                      Input $/M
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

                    return (
                      <tr
                        key={`${pricing.provider_name}-${index}`}
                        className={`border-b border-border/30 ${isDirect ? "bg-neon/5" : ""}`}
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
                              Lowest input
                            </Badge>
                          )}
                          {pricing.source && (
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              Source: {pricing.source}
                            </div>
                          )}
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <Badge variant="outline" className="text-[10px]">
                            {isDirect ? "Direct" : "Broker / Router"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums">
                          {pricing.input_price_per_million != null
                            ? formatTokenPrice(pricing.input_price_per_million)
                            : "---"}
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
