import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PriceComparison } from "@/components/charts/price-comparison";
import { formatTokenPrice } from "@/lib/format";

export interface PricingEntry {
  provider_name: string;
  input_price_per_million: number | null;
  output_price_per_million: number | null;
  median_output_tokens_per_second: number | null;
  median_time_to_first_token: number | null;
}

export interface PricingTabProps {
  pricingData: PricingEntry[];
}

export function PricingTab({ pricingData }: PricingTabProps) {
  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg">Pricing Across Providers</CardTitle>
      </CardHeader>
      <CardContent>
        {pricingData.length > 1 && (
          <div className="mb-6">
            <PriceComparison
              models={pricingData.map((p) => ({
                name: p.provider_name,
                inputPrice: p.input_price_per_million,
                outputPrice: p.output_price_per_million,
              }))}
            />
          </div>
        )}
        {pricingData.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-border/50">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-secondary/30">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Provider</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Input $/M</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Output $/M</th>
                  <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground sm:table-cell">Speed</th>
                  <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground md:table-cell">TTFT</th>
                </tr>
              </thead>
              <tbody>
                {pricingData
                  .sort((a, b) => (a.input_price_per_million ?? 0) - (b.input_price_per_million ?? 0))
                  .map((p, i) => (
                  <tr key={i} className={`border-b border-border/30 ${i === 0 ? "bg-neon/5" : ""}`}>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium">{p.provider_name}</span>
                      {i === 0 && (
                        <Badge className="ml-2 bg-neon/10 text-[10px] text-neon">Cheapest</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums">
                      {p.input_price_per_million != null ? formatTokenPrice(p.input_price_per_million) : "---"}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums">
                      {p.output_price_per_million != null ? formatTokenPrice(p.output_price_per_million) : "---"}
                    </td>
                    <td className="hidden px-4 py-3 text-right text-sm tabular-nums text-muted-foreground sm:table-cell">
                      {p.median_output_tokens_per_second ? `${Number(p.median_output_tokens_per_second).toFixed(0)} tok/s` : "---"}
                    </td>
                    <td className="hidden px-4 py-3 text-right text-sm tabular-nums text-muted-foreground md:table-cell">
                      {p.median_time_to_first_token ? `${Number(p.median_time_to_first_token).toFixed(2)}s` : "---"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">No pricing data available yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
