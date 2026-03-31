import type { ModelWithDetails, BenchmarkScore, ModelPricing, Benchmark } from "@/types/database";
import type { ModelSignalSummary } from "@/lib/news/model-signals";

/** Supabase joins benchmark_scores with benchmarks table using plural name */
export type BenchmarkScoreWithBenchmarks = BenchmarkScore & {
  benchmarks?: Benchmark;
};

export interface BenchmarkInfo {
  name: string;
  slug: string;
  category: string;
}

export interface CompareAccessOffer {
  monthlyPriceLabel: string;
  actionLabel: string;
}

export function getBenchmarkScore(
  model: ModelWithDetails,
  benchSlug: string
): number | null {
  const scores = model.benchmark_scores ?? [];
  const match = (scores as BenchmarkScoreWithBenchmarks[]).find(
    (s) => s.benchmarks?.slug === benchSlug
  );
  return match ? Number(match.score) : null;
}

export function getCheapestPrice(model: ModelWithDetails): number | null {
  const pricing = model.model_pricing ?? [];
  if (pricing.length === 0) return null;
  const prices = pricing
    .map((p: ModelPricing) => Number(p.input_price_per_million))
    .filter((p: number) => !isNaN(p) && p > 0);
  return prices.length > 0 ? Math.min(...prices) : null;
}

export function getSpeed(model: ModelWithDetails): number | null {
  const pricing = model.model_pricing ?? [];
  const speeds = pricing
    .map((p: ModelPricing) => Number(p.median_output_tokens_per_second))
    .filter((s: number) => !isNaN(s) && s > 0);
  return speeds.length > 0 ? Math.max(...speeds) : null;
}

export function getCompareDeploymentLabel(input: {
  model: Pick<ModelWithDetails, "is_open_weights">;
  signal: ModelSignalSummary | null;
  accessOffer: CompareAccessOffer | null;
}): string {
  if (input.signal?.signalType === "open_source") return "Self-Host";
  if (input.signal?.signalType === "api") return "Deployable";
  if (input.accessOffer?.actionLabel === "Deploy") return "Deployable";
  if (input.accessOffer?.actionLabel === "Get API Access") return "API Access";
  if (input.accessOffer?.actionLabel === "Subscribe") return "Subscription";
  if (input.accessOffer?.actionLabel === "Start Free Trial") return "Free Trial";
  if (input.model.is_open_weights) return "Open Weights";
  return "Not Verified";
}

export function getCompareAccessLabel(accessOffer: CompareAccessOffer | null): string | null {
  if (!accessOffer) return null;
  return `${accessOffer.actionLabel} · ${accessOffer.monthlyPriceLabel}`;
}
