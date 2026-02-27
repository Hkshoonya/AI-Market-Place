import Link from "next/link";
import { Crown, Trophy, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CATEGORIES } from "@/lib/constants/categories";
import { createClient } from "@/lib/supabase/server";
import { formatTokenPrice } from "@/lib/format";
import { ProviderLogo } from "@/components/shared/provider-logo";
import { SpeedCostScatter } from "@/components/charts/speed-cost-scatter";
import { QualityDistribution } from "@/components/charts/quality-distribution";
import { getProviderBrand } from "@/lib/constants/providers";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Model Leaderboards",
  description: "Rankings of AI models across benchmarks, categories, and real-world performance.",
};

export const revalidate = 1800;

export default async function LeaderboardsPage() {
  const supabase = await createClient();

  // Fetch ranked models with benchmarks, pricing, elo
  const { data: rankedModelsRaw } = await supabase
    .from("models")
    .select("*, rankings(*), model_pricing(*), benchmark_scores(*, benchmarks(*)), elo_ratings(*)")
    .eq("status", "active")
    .not("overall_rank", "is", null)
    .order("overall_rank", { ascending: true })
    .limit(20);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rankedModels = rankedModelsRaw as any[] | null;

  // Fetch speed-ranked models (by median output tokens per second)
  const { data: speedModelsRaw } = await supabase
    .from("model_pricing")
    .select("*, models!inner(id, slug, name, provider, category, overall_rank, quality_score, is_open_weights)")
    .not("median_output_tokens_per_second", "is", null)
    .order("median_output_tokens_per_second", { ascending: false })
    .limit(10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const speedModels = speedModelsRaw as any[] | null;

  // Fetch value-ranked models (cheapest with good quality)
  const { data: valueModelsRaw } = await supabase
    .from("model_pricing")
    .select("*, models!inner(id, slug, name, provider, category, overall_rank, quality_score, is_open_weights)")
    .not("input_price_per_million", "is", null)
    .order("input_price_per_million", { ascending: true })
    .limit(10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const valueModels = valueModelsRaw as any[] | null;

  // Helper to get benchmark score
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function getBenchmarkScore(model: any, benchmarkSlug: string): number | null {
    const scores = model.benchmark_scores as { score: number; benchmarks: { slug: string } | null }[];
    const found = scores?.find((bs) => bs.benchmarks?.slug === benchmarkSlug);
    return found ? Number(found.score) : null;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <Trophy className="h-6 w-6 text-neon" />
          <h1 className="text-2xl font-bold">AI Model Leaderboards</h1>
        </div>
        <p className="mt-2 text-muted-foreground">
          Rankings across benchmarks, categories, speed, and value. Updated every 6 hours.
        </p>
      </div>

      {/* Category Quick Links */}
      <div className="mb-8 flex flex-wrap gap-2">
        <Badge variant="outline" className="cursor-pointer border-neon/30 bg-neon/10 text-xs text-neon">
          All Models
        </Badge>
        {CATEGORIES.map((cat) => (
          <Link key={cat.slug} href={`/leaderboards/${cat.slug}`}>
            <Badge
              variant="outline"
              className="cursor-pointer gap-1 border-border/50 text-xs text-muted-foreground hover:border-neon/30 hover:text-foreground"
            >
              <cat.icon className="h-3 w-3" />
              {cat.shortLabel}
            </Badge>
          </Link>
        ))}
      </div>

      {/* Main Leaderboard Tabs */}
      <Tabs defaultValue="overall">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="overall">Overall</TabsTrigger>
          <TabsTrigger value="speed">Speed</TabsTrigger>
          <TabsTrigger value="value">Best Value</TabsTrigger>
        </TabsList>

        {/* Overall Tab */}
        <TabsContent value="overall" className="mt-6">
          {rankedModels && rankedModels.length > 0 && (
            <QualityDistribution
              data={rankedModels.map((m: any) => ({
                name: m.name,
                quality: Number(m.quality_score) || 0,
                provider: m.provider,
              }))}
            />
          )}
          <div className="overflow-hidden rounded-xl border border-border/50">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-secondary/30">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground w-12">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Model</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Quality</th>
                  <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground sm:table-cell">MMLU</th>
                  <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground md:table-cell">HumanEval</th>
                  <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground lg:table-cell">MATH</th>
                  <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground md:table-cell">$/M tokens</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground w-16">Change</th>
                </tr>
              </thead>
              <tbody>
                {rankedModels?.map((model) => {
                  const rank = model.overall_rank ?? 0;
                  const overallRanking = (model.rankings as { ranking_type: string; previous_rank: number | null }[])?.find(
                    (r) => r.ranking_type === "overall"
                  );
                  const change = overallRanking?.previous_rank
                    ? overallRanking.previous_rank - rank
                    : 0;
                  const cheapestPricing = (model.model_pricing as { input_price_per_million: number | null }[])
                    ?.filter((p) => p.input_price_per_million != null)
                    .sort((a, b) =>
                      (a.input_price_per_million ?? 0) - (b.input_price_per_million ?? 0)
                    )[0];

                  const mmlu = getBenchmarkScore(model, "mmlu");
                  const humaneval = getBenchmarkScore(model, "humaneval");
                  const math = getBenchmarkScore(model, "math");

                  return (
                    <tr
                      key={model.id}
                      className="border-b border-border/30 transition-colors hover:bg-secondary/20"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1">
                          {rank <= 3 && (
                            <Crown
                              className={`h-3.5 w-3.5 ${rank === 1 ? "text-[#FFD700]" : rank === 2 ? "text-[#C0C0C0]" : "text-[#CD7F32]"}`}
                            />
                          )}
                          <span className={`text-sm font-bold tabular-nums ${rank <= 3 ? "text-neon" : "text-muted-foreground"}`}>
                            {rank}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <Link href={`/models/${model.slug}`}>
                          <div className="flex items-center gap-2">
                            <ProviderLogo provider={model.provider} size="sm" />
                            <div>
                              <span className="text-sm font-semibold hover:text-neon transition-colors">{model.name}</span>
                              <span className="ml-2 text-xs text-muted-foreground">{model.provider}</span>
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-sm font-bold tabular-nums text-neon">
                          {model.quality_score ? Number(model.quality_score).toFixed(1) : "—"}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3.5 text-right text-sm tabular-nums sm:table-cell">
                        {mmlu?.toFixed(1) ?? "—"}
                      </td>
                      <td className="hidden px-4 py-3.5 text-right text-sm tabular-nums md:table-cell">
                        {humaneval?.toFixed(1) ?? "—"}
                      </td>
                      <td className="hidden px-4 py-3.5 text-right text-sm tabular-nums lg:table-cell">
                        {math?.toFixed(1) ?? "—"}
                      </td>
                      <td className="hidden px-4 py-3.5 text-right text-sm md:table-cell">
                        {cheapestPricing ? (
                          <span className="text-muted-foreground">
                            {formatTokenPrice(cheapestPricing.input_price_per_million)}
                          </span>
                        ) : model.is_open_weights ? (
                          <span className="text-gain font-medium">Free</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className={`text-xs font-medium ${change > 0 ? "text-gain" : change < 0 ? "text-loss" : "text-muted-foreground"}`}>
                          {change > 0 && `▲${change}`}
                          {change < 0 && `▼${Math.abs(change)}`}
                          {change === 0 && "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Speed Tab */}
        <TabsContent value="speed" className="mt-6">
          {speedModels && speedModels.length > 0 && (
            <div className="mb-6">
              <SpeedCostScatter
                data={speedModels
                  .filter((p: any) => p.input_price_per_million != null)
                  .map((p: any) => ({
                    name: p.models.name,
                    speed: Number(p.median_output_tokens_per_second),
                    cost: Number(p.input_price_per_million),
                    provider: p.provider_name,
                    color: getProviderBrand(p.provider_name)?.color ?? "#666",
                  }))}
              />
            </div>
          )}
          <div className="overflow-hidden rounded-xl border border-border/50">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-secondary/30">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground w-12">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Model</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Provider</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Speed</th>
                  <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground sm:table-cell">TTFT</th>
                  <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground md:table-cell">$/M in</th>
                </tr>
              </thead>
              <tbody>
                {speedModels?.map((pricing, i) => {
                  const model = pricing.models as { id: string; slug: string; name: string; provider: string };
                  return (
                    <tr key={pricing.id} className="border-b border-border/30 transition-colors hover:bg-secondary/20">
                      <td className="px-4 py-3.5">
                        <span className={`text-sm font-bold tabular-nums ${i < 3 ? "text-neon" : "text-muted-foreground"}`}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <Link href={`/models/${model.slug}`}>
                          <span className="text-sm font-semibold hover:text-neon transition-colors">{model.name}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-muted-foreground">{pricing.provider_name}</td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="flex items-center justify-end gap-1 text-sm font-bold tabular-nums text-neon">
                          <Zap className="h-3 w-3" />
                          {Number(pricing.median_output_tokens_per_second).toFixed(0)} tok/s
                        </span>
                      </td>
                      <td className="hidden px-4 py-3.5 text-right text-sm tabular-nums text-muted-foreground sm:table-cell">
                        {pricing.median_time_to_first_token ? `${Number(pricing.median_time_to_first_token).toFixed(2)}s` : "—"}
                      </td>
                      <td className="hidden px-4 py-3.5 text-right text-sm text-muted-foreground md:table-cell">
                        {pricing.input_price_per_million
                          ? formatTokenPrice(pricing.input_price_per_million)
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Value Tab */}
        <TabsContent value="value" className="mt-6">
          <div className="overflow-hidden rounded-xl border border-border/50">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-secondary/30">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground w-12">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Model</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Provider</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">$/M in</th>
                  <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground sm:table-cell">$/M out</th>
                  <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground md:table-cell">Quality</th>
                </tr>
              </thead>
              <tbody>
                {valueModels?.map((pricing, i) => {
                  const model = pricing.models as { id: string; slug: string; name: string; provider: string; quality_score: number | null };
                  return (
                    <tr key={pricing.id} className="border-b border-border/30 transition-colors hover:bg-secondary/20">
                      <td className="px-4 py-3.5">
                        <span className={`text-sm font-bold tabular-nums ${i < 3 ? "text-neon" : "text-muted-foreground"}`}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <Link href={`/models/${model.slug}`}>
                          <span className="text-sm font-semibold hover:text-neon transition-colors">{model.name}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-muted-foreground">{pricing.provider_name}</td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-sm font-bold tabular-nums text-gain">
                          {formatTokenPrice(pricing.input_price_per_million)}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3.5 text-right text-sm tabular-nums text-muted-foreground sm:table-cell">
                        {formatTokenPrice(pricing.output_price_per_million)}
                      </td>
                      <td className="hidden px-4 py-3.5 text-right text-sm tabular-nums md:table-cell">
                        {model.quality_score ? Number(model.quality_score).toFixed(1) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
