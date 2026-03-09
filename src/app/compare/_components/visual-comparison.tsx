"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BenchmarkRadarOverlay } from "@/components/charts/benchmark-radar-overlay";
import { PriceComparison } from "@/components/charts/price-comparison";
import { SpeedCostScatter } from "@/components/charts/speed-cost-scatter";
import { getProviderBrand } from "@/lib/constants/providers";
import type { ModelWithDetails, ModelPricing } from "@/types/database";
import type { BenchmarkScoreWithBenchmarks } from "./compare-helpers";

interface VisualComparisonProps {
  models: ModelWithDetails[];
}

const CHART_COLORS = ["#00d4aa", "#f59e0b", "#ec4899", "#6366f1", "#ef4444"];

export function VisualComparison({ models }: VisualComparisonProps) {
  const hasBenchmarks = models.some(
    (m) => (m.benchmark_scores ?? []).length > 0
  );
  const hasPricing = models.some(
    (m) => (m.model_pricing ?? []).length > 0
  );
  const hasSpeedCost = models.some((m) => {
    const pricing = m.model_pricing ?? [];
    return pricing.some(
      (p: ModelPricing) =>
        p.median_output_tokens_per_second != null &&
        p.input_price_per_million != null
    );
  });

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        {hasBenchmarks && (
          <Card className="border-border/50 overflow-hidden">
            <CardHeader className="bg-secondary/20">
              <CardTitle className="text-lg">Benchmark Comparison</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <BenchmarkRadarOverlay
                models={models
                  .filter((m) => (m.benchmark_scores ?? []).length > 0)
                  .map((m, i) => ({
                    modelName: m.name,
                    color: CHART_COLORS[i % CHART_COLORS.length],
                    scores: (
                      (m.benchmark_scores ?? []) as BenchmarkScoreWithBenchmarks[]
                    ).map((bs) => ({
                      benchmark: bs.benchmarks?.name ?? "Unknown",
                      score: Number(bs.score),
                      maxScore: Number(bs.benchmarks?.max_score) || 100,
                    })),
                  }))}
              />
            </CardContent>
          </Card>
        )}

        {hasPricing && (
          <Card className="border-border/50 overflow-hidden">
            <CardHeader className="bg-secondary/20">
              <CardTitle className="text-lg">Price Comparison</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <PriceComparison
                models={models.map((m) => {
                  const pricing = m.model_pricing ?? [];
                  const cheapest = pricing
                    .filter(
                      (p: ModelPricing) => p.input_price_per_million != null
                    )
                    .sort(
                      (a: ModelPricing, b: ModelPricing) =>
                        (a.input_price_per_million ?? 0) -
                        (b.input_price_per_million ?? 0)
                    )[0];
                  return {
                    name: m.name,
                    inputPrice: cheapest?.input_price_per_million ?? null,
                    outputPrice: cheapest?.output_price_per_million ?? null,
                  };
                })}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {hasSpeedCost && (
        <Card className="border-border/50 overflow-hidden">
          <CardHeader className="bg-secondary/20">
            <CardTitle className="text-lg">Speed vs Cost</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <SpeedCostScatter
              data={
                models
                  .map((m) => {
                    const pricing = m.model_pricing ?? [];
                    const best = pricing.find(
                      (p: ModelPricing) =>
                        p.median_output_tokens_per_second != null &&
                        p.input_price_per_million != null
                    );
                    if (!best) return null;
                    return {
                      name: m.name,
                      speed: Number(best.median_output_tokens_per_second),
                      cost: Number(best.input_price_per_million),
                      provider: m.provider,
                      color:
                        getProviderBrand(m.provider)?.color ?? "#888",
                    };
                  })
                  .filter(Boolean) as {
                  name: string;
                  speed: number;
                  cost: number;
                  provider: string;
                  color: string;
                }[]
              }
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}
