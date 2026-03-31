"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComparisonRow } from "./comparison-row";
import {
  getCheapestPrice,
  getCompareAccessLabel,
  getSpeed,
  type CompareAccessOffer,
} from "./compare-helpers";
import type { ModelWithDetails, ModelPricing } from "@/types/database";

interface PricingTableProps {
  models: ModelWithDetails[];
  accessOffers: Record<string, CompareAccessOffer | null>;
}

export function PricingTable({ models, accessOffers }: PricingTableProps) {
  const inputPriceValues = useMemo(
    () =>
      models.map((m) => {
        const price = getCheapestPrice(m);
        return price !== null ? `$${price.toFixed(2)}` : null;
      }),
    [models]
  );

  const outputPriceValues = useMemo(
    () =>
      models.map((m) => {
        const pricing = m.model_pricing ?? [];
        if (pricing.length === 0) return null;
        const prices = pricing
          .map((p: ModelPricing) => Number(p.output_price_per_million))
          .filter((p: number) => !isNaN(p) && p > 0);
        return prices.length > 0 ? `$${Math.min(...prices).toFixed(2)}` : null;
      }),
    [models]
  );

  const speedValues = useMemo(
    () =>
      models.map((m) => {
        const speed = getSpeed(m);
        return speed !== null ? `${speed.toFixed(0)}` : null;
      }),
    [models]
  );

  const freeTierValues = useMemo(
    () =>
      models.map((m) => {
        const pricing = m.model_pricing ?? [];
        return pricing.some((p: ModelPricing) => p.is_free_tier) ? "Yes" : "No";
      }),
    [models]
  );

  const accessValues = useMemo(
    () => models.map((m) => getCompareAccessLabel(accessOffers[m.slug] ?? null)),
    [accessOffers, models]
  );

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardHeader className="bg-secondary/20">
        <CardTitle className="text-lg">Pricing & Speed</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground w-40">
                  Metric
                </th>
                {models.map((m) => (
                  <th
                    key={m.slug}
                    className="px-4 py-3 text-center text-xs font-medium"
                  >
                    {m.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <ComparisonRow
                label="Input $/M tokens"
                values={inputPriceValues}
                highlight="min"
              />
              <ComparisonRow
                label="Output $/M tokens"
                values={outputPriceValues}
                highlight="min"
              />
              <ComparisonRow
                label="Speed (tok/s)"
                values={speedValues}
                highlight="max"
              />
              <ComparisonRow label="Best Access" values={accessValues} />
              <ComparisonRow label="Free Tier" values={freeTierValues} />
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
