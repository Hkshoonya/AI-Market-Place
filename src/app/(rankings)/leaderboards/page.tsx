import Link from "next/link";
import { Crown, Trophy, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CATEGORIES } from "@/lib/constants/categories";
import { createPublicClient } from "@/lib/supabase/public-server";
import { parseQueryResult } from "@/lib/schemas/parse";
import { RankedModelSchema, SpeedModelSchema, ValueModelSchema } from "@/lib/schemas/rankings";
import { ExplorerModelSchema } from "@/lib/schemas/models";
import type { z } from "zod";
// REMOVED: import { formatTokenPrice, formatNumber } from "@/lib/format";
import { formatTokenPrice } from "@/lib/format";
import { ProviderLogo } from "@/components/shared/provider-logo";
import { SpeedCostScatter } from "@/components/charts/speed-cost-scatter";
import { QualityDistribution } from "@/components/charts/quality-distribution";
import { getProviderBrand } from "@/lib/constants/providers";
import LeaderboardExplorer from "@/components/models/leaderboard-explorer";
import { LeaderboardLensNav } from "@/components/models/leaderboard-lens-nav";
import QualityPriceFrontier from "@/components/charts/quality-price-frontier";
import BenchmarkHeatmap from "@/components/charts/benchmark-heatmap";
import RankTimeline from "@/components/charts/rank-timeline";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Model Leaderboards",
  description: "Rankings of AI models across benchmarks, categories, and real-world performance.",
};

export const revalidate = 60;

export default async function LeaderboardsPage() {
  const supabase = createPublicClient();

  // Fetch ranked models with benchmarks, pricing, elo — sorted by overall rank
  const rankedModelsResponse = await supabase
    .from("models")
    .select("*, rankings(*), model_pricing(*), benchmark_scores(*, benchmarks(*)), elo_ratings(*)")
    .eq("status", "active")
    .not("overall_rank", "is", null)
    .order("overall_rank", { ascending: true })
    .limit(20);

  type RankedModel = z.infer<typeof RankedModelSchema>;
  const rankedModels = parseQueryResult(rankedModelsResponse, RankedModelSchema, "RankedModel");

  // Fetch ALL ranked models for the explorer (client component)
  const explorerModelsResponse = await supabase
    .from("models")
    .select("name, slug, provider, category, overall_rank, category_rank, quality_score, value_score, is_open_weights, hf_downloads, popularity_score, popularity_rank, adoption_score, adoption_rank, economic_footprint_score, economic_footprint_rank, agent_score, agent_rank, market_cap_estimate, capability_score, capability_rank, usage_score, usage_rank, expert_score, expert_rank, balanced_rank")
    .eq("status", "active")
    .not("overall_rank", "is", null)
    .order("overall_rank", { ascending: true })
    .limit(500);

  const explorerModels = parseQueryResult(explorerModelsResponse, ExplorerModelSchema, "ExplorerModel").map((m) => ({
    name: m.name,
    slug: m.slug,
    provider: m.provider,
    category: m.category,
    overall_rank: m.overall_rank,
    category_rank: m.category_rank,
    quality_score: m.quality_score != null ? Number(m.quality_score) : null,
    value_score: m.value_score != null ? Number(m.value_score) : null,
    is_open_weights: !!(m.is_open_weights),
    hf_downloads: m.hf_downloads != null ? Number(m.hf_downloads) : null,
    popularity_score: m.popularity_score != null ? Number(m.popularity_score) : null,
    adoption_score: m.adoption_score != null ? Number(m.adoption_score) : null,
    adoption_rank: m.adoption_rank,
    agent_score: m.agent_score != null ? Number(m.agent_score) : null,
    agent_rank: m.agent_rank,
    popularity_rank: m.popularity_rank,
    economic_footprint_score: m.economic_footprint_score != null ? Number(m.economic_footprint_score) : null,
    economic_footprint_rank: m.economic_footprint_rank,
    market_cap_estimate: m.market_cap_estimate != null ? Number(m.market_cap_estimate) : null,
    capability_score: m.capability_score != null ? Number(m.capability_score) : null,
    capability_rank: m.capability_rank,
    usage_score: m.usage_score != null ? Number(m.usage_score) : null,
    usage_rank: m.usage_rank,
    expert_score: m.expert_score != null ? Number(m.expert_score) : null,
    expert_rank: m.expert_rank,
    balanced_rank: m.balanced_rank,
  }));

  // Fetch speed-ranked models
  const speedModelsResponse = await supabase
    .from("model_pricing")
    .select("*, models!inner(id, slug, name, provider, category, overall_rank, quality_score, is_open_weights)")
    .not("median_output_tokens_per_second", "is", null)
    .order("median_output_tokens_per_second", { ascending: false })
    .limit(10);

  const speedModels = parseQueryResult(speedModelsResponse, SpeedModelSchema, "SpeedModel");

  // Fetch value-ranked models
  const valueModelsResponse = await supabase
    .from("model_pricing")
    .select("*, models!inner(id, slug, name, provider, category, overall_rank, quality_score, is_open_weights)")
    .not("input_price_per_million", "is", null)
    .order("input_price_per_million", { ascending: true })
    .limit(10);

  const valueModels = parseQueryResult(valueModelsResponse, ValueModelSchema, "ValueModel");

  function getBenchmarkScore(model: RankedModel, benchmarkSlug: string): number | null {
    const scores = model.benchmark_scores;
    const found = scores?.find((bs) => bs.benchmarks?.slug === benchmarkSlug);
    return found ? Number(found.score_normalized) : null;
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
          Rankings across capability, popularity, adoption, economic footprint, speed, and value. Updated every 6 hours.
        </p>
        <div className="mt-6">
          <LeaderboardLensNav />
        </div>
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
      <Tabs defaultValue="explorer">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="explorer">Explorer</TabsTrigger>
          <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
          <TabsTrigger value="frontier">Quality vs Price</TabsTrigger>
          <TabsTrigger value="timeline">Rank History</TabsTrigger>
          <TabsTrigger value="agent">Agent Score</TabsTrigger>
          <TabsTrigger value="overall">Top 20</TabsTrigger>
          <TabsTrigger value="speed">Speed</TabsTrigger>
          <TabsTrigger value="value">Best Value</TabsTrigger>
        </TabsList>

        {/* Explorer Tab — Bloomberg-style data grid */}
        <TabsContent value="explorer" className="mt-6">
          <LeaderboardExplorer models={explorerModels} />
        </TabsContent>

        {/* Benchmarks Tab — Heatmap */}
        <TabsContent value="benchmarks" className="mt-6">
          <BenchmarkHeatmap />
        </TabsContent>

        {/* Frontier Tab — Quality vs Price scatter */}
        <TabsContent value="frontier" className="mt-6">
          <QualityPriceFrontier />
        </TabsContent>

        {/* Timeline Tab — Rank movement */}
        <TabsContent value="timeline" className="mt-6">
          <RankTimeline />
        </TabsContent>

        {/* Agent Score Tab */}
        <TabsContent value="agent" className="mt-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Zap className="h-5 w-5 text-neon" />
              Agent Score Leaderboard
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Composite score from 9 agentic benchmarks: SWE-Bench, TerminalBench, OSWorld, GAIA, WebArena, Aider, HumanEval, TAU-Bench, AgentBench.
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border border-border/50">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-secondary/30">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground w-12">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Model</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Agent Score</th>
                  <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground sm:table-cell">Quality</th>
                  <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground md:table-cell">Popularity</th>
                  <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground lg:table-cell">Economic</th>
                </tr>
              </thead>
              <tbody>
                {explorerModels
                  .filter((m) => m.agent_score != null)
                  .sort((a, b) => (a.agent_rank ?? 999) - (b.agent_rank ?? 999))
                  .slice(0, 50)
                  .map((model, i) => (
                  <tr key={model.slug} className="border-b border-border/30 table-row-hover">
                    <td className="px-4 py-3.5">
                      <span className={`text-sm font-bold tabular-nums ${i < 3 ? "text-neon" : "text-muted-foreground"}`}>
                        {model.agent_rank ?? i + 1}
                      </span>
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
                        {model.agent_score?.toFixed(1) ?? "---"}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3.5 text-right text-sm tabular-nums sm:table-cell">
                      {model.quality_score?.toFixed(1) ?? "---"}
                    </td>
                    <td className="hidden px-4 py-3.5 text-right text-sm tabular-nums md:table-cell">
                      {model.popularity_rank ? `#${model.popularity_rank}` : "---"}
                    </td>
                    <td className="hidden px-4 py-3.5 text-right text-sm tabular-nums lg:table-cell">
                      {model.economic_footprint_score != null
                        ? model.economic_footprint_score.toFixed(1)
                        : "---"}
                    </td>
                  </tr>
                ))}
                {explorerModels.filter((m) => m.agent_score != null).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No agent scores computed yet. Run compute-scores to populate.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Overall Tab — Top 20 by Composite Rank */}
        <TabsContent value="overall" className="mt-6">
          {rankedModels.length > 0 && (
            <div className="mb-6">
              <QualityDistribution
                data={rankedModels.map((m) => ({
                  name: m.name,
                  quality: Number(m.quality_score) || 0,
                  provider: m.provider as string,
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
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Economic Footprint</th>
                  <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground sm:table-cell">Quality</th>
                  <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground md:table-cell">MMLU</th>
                  <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground md:table-cell">HumanEval</th>
                  <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground lg:table-cell">MATH</th>
                  <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground lg:table-cell">$/M tokens</th>
                  <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground xl:table-cell">Adoption</th>
                  <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground 2xl:table-cell">Popularity</th>
                </tr>
              </thead>
              <tbody>
                {rankedModels.map((model, index) => {
                  const rank = index + 1;
                  const economicFootprint = model.economic_footprint_score != null ? Number(model.economic_footprint_score) : null;
                  const adoptionScore = model.adoption_score != null ? Number(model.adoption_score) : null;
                  const popScore = model.popularity_score != null ? Number(model.popularity_score) : null;
                  const mmlu = getBenchmarkScore(model, "mmlu") ?? getBenchmarkScore(model, "mmlu-pro");
                  const humanEval = getBenchmarkScore(model, "humaneval") ?? getBenchmarkScore(model, "humaneval-plus");
                  const math = getBenchmarkScore(model, "math-benchmark") ?? getBenchmarkScore(model, "math");
                  const cheapestPricing = (model.model_pricing as { input_price_per_million: number | null }[])
                    ?.filter((p) => p.input_price_per_million != null)
                    .sort((a, b) =>
                      (a.input_price_per_million ?? 0) - (b.input_price_per_million ?? 0)
                    )[0];

                  return (
                    <tr key={model.id} className="border-b border-border/30 table-row-hover cursor-pointer">
                      <td className="px-4 py-3.5">
                        <Link href={`/models/${model.slug}`} className="block">
                          <div className="flex items-center gap-1">
                            {rank <= 3 && (
                              <Crown className={`h-3.5 w-3.5 ${rank === 1 ? "text-[#FFD700]" : rank === 2 ? "text-[#C0C0C0]" : "text-[#CD7F32]"}`} />
                            )}
                            <span className={`text-sm font-bold tabular-nums ${rank <= 3 ? "text-neon" : "text-muted-foreground"}`}>
                              {rank}
                            </span>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <Link href={`/models/${model.slug}`} className="block">
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
                        <Link href={`/models/${model.slug}`} className="block">
                          <span className="text-sm font-bold tabular-nums text-neon">
                            {economicFootprint
                              ? economicFootprint.toFixed(1)
                              : "—"}
                          </span>
                        </Link>
                      </td>
                      <td className="hidden px-4 py-3.5 text-right sm:table-cell">
                        <Link href={`/models/${model.slug}`} className="block">
                          <span className="text-sm font-semibold tabular-nums">
                            {model.quality_score ? Number(model.quality_score).toFixed(1) : "—"}
                          </span>
                        </Link>
                      </td>
                      <td className="hidden px-4 py-3.5 text-right text-sm tabular-nums md:table-cell">
                        <Link href={`/models/${model.slug}`} className="block">
                          <span className={mmlu ? "text-foreground" : "text-muted-foreground"}>
                            {mmlu ? mmlu.toFixed(1) : "—"}
                          </span>
                        </Link>
                      </td>
                      <td className="hidden px-4 py-3.5 text-right text-sm tabular-nums md:table-cell">
                        <Link href={`/models/${model.slug}`} className="block">
                          <span className={humanEval ? "text-foreground" : "text-muted-foreground"}>
                            {humanEval ? humanEval.toFixed(1) : "—"}
                          </span>
                        </Link>
                      </td>
                      <td className="hidden px-4 py-3.5 text-right text-sm tabular-nums lg:table-cell">
                        <Link href={`/models/${model.slug}`} className="block">
                          <span className={math ? "text-foreground" : "text-muted-foreground"}>
                            {math ? math.toFixed(1) : "—"}
                          </span>
                        </Link>
                      </td>
                      <td className="hidden px-4 py-3.5 text-right text-sm lg:table-cell">
                        <Link href={`/models/${model.slug}`} className="block">
                          {cheapestPricing ? (
                            <span className="text-muted-foreground">
                              {formatTokenPrice(cheapestPricing.input_price_per_million)}
                            </span>
                          ) : model.is_open_weights ? (
                            <span className="text-gain font-medium">Free</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </Link>
                      </td>
                      <td className="hidden px-4 py-3.5 text-right xl:table-cell">
                        <Link href={`/models/${model.slug}`} className="block">
                          <span className="text-sm tabular-nums text-muted-foreground">
                            {adoptionScore?.toFixed(1) ?? "—"}
                          </span>
                        </Link>
                      </td>
                      <td className="hidden px-4 py-3.5 text-right 2xl:table-cell">
                        <Link href={`/models/${model.slug}`} className="block">
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
                              <div
                                className="h-full rounded-full bg-neon/70"
                                style={{ width: `${Math.min(popScore ?? 0, 100)}%` }}
                              />
                            </div>
                            <span className="text-sm tabular-nums text-muted-foreground w-10 text-right">
                              {popScore?.toFixed(0) ?? "—"}
                            </span>
                          </div>
                        </Link>
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
          {speedModels.length > 0 && (
            <div className="mb-6">
              <SpeedCostScatter
                data={speedModels
                  .filter((p) => p.input_price_per_million != null)
                  .map((p) => ({
                    name: p.models.name,
                    speed: Number(p.median_output_tokens_per_second),
                    cost: Number(p.input_price_per_million),
                    provider: p.provider_name ?? "",
                    color: getProviderBrand(p.provider_name ?? "")?.color ?? "#666",
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
                {speedModels.map((pricing, i) => {
                  const model = pricing.models as { id: string; slug: string; name: string; provider: string };
                  return (
                    <tr key={pricing.id} className="border-b border-border/30 table-row-hover">
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
                {valueModels.map((pricing, i) => {
                  const model = pricing.models as { id: string; slug: string; name: string; provider: string; quality_score: number | null };
                  return (
                    <tr key={pricing.id} className="border-b border-border/30 table-row-hover">
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
