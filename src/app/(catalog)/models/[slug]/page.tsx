import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  Code,
  Download,
  ExternalLink,
  Globe,
  Heart,
  MessageSquare,
  Newspaper,
  Shield,
  Swords,
  Trophy,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { CATEGORIES } from "@/lib/constants/categories";
import { createClient } from "@/lib/supabase/server";
import { formatNumber, formatParams, formatContextWindow, formatTokenPrice } from "@/lib/format";
import { ModelActions } from "@/components/models/model-actions";
import { ShareModel } from "@/components/models/share-model";
import { CommentsSection } from "@/components/models/comments-section";
import { SimilarModels } from "@/components/models/similar-models";
import { ProviderLogo } from "@/components/shared/provider-logo";
import { BenchmarkRadar } from "@/components/charts/benchmark-radar";
import { QualityTrend } from "@/components/charts/quality-trend";
import { DownloadsTrend } from "@/components/charts/downloads-trend";
import { PriceComparison } from "@/components/charts/price-comparison";
import { NewsCard } from "@/components/news/news-card";
import { DeployTab } from "@/components/models/deploy-tab";
import { ModelOverview } from "@/components/models/model-overview";
import { TradingChart } from "@/components/charts/trading-chart";
import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/constants/site";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("models")
    .select("name, provider, short_description, category")
    .eq("slug", slug)
    .single();

  const model = data as { name: string; provider: string; short_description: string | null; category: string } | null;

  if (!model) {
    return { title: "Model Not Found" };
  }

  const title = `${model.name} by ${model.provider}`;
  const description =
    model.short_description ??
    `Explore ${model.name} by ${model.provider} — benchmarks, pricing, and comparisons on ${SITE_NAME}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/models/${slug}`,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical: `${SITE_URL}/models/${slug}`,
    },
  };
}

export default async function ModelDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("models")
    .select(
      `
      *,
      benchmark_scores(*, benchmarks(*)),
      model_pricing(*),
      elo_ratings(*),
      rankings(*),
      model_updates(*)
    `
    )
    .eq("slug", slug)
    .single();

  if (error || !data) {
    notFound();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = data as any;

  // Fetch historical snapshots for trends
  const { data: snapshotsRaw } = await supabase
    .from("model_snapshots")
    .select("snapshot_date, quality_score, hf_downloads, hf_likes, overall_rank")
    .eq("model_id", model.id)
    .order("snapshot_date", { ascending: true });
  const snapshots = (snapshotsRaw as any[] | null) ?? [];

  // Fetch similar models (same category, excluding current model)
  const { data: similarRaw } = await supabase
    .from("models")
    .select(
      "id, slug, name, provider, category, overall_rank, quality_score, hf_downloads, parameter_count, is_open_weights"
    )
    .eq("status", "active")
    .eq("category", model.category)
    .neq("id", model.id)
    .order("quality_score", { ascending: false, nullsFirst: false })
    .limit(5);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const similarModels = (similarRaw as any[] | null) ?? [];

  // Fetch news linked to this model
  const { data: newsRaw } = await supabase
    .from("model_news")
    .select("id, title, summary, url, source, category, related_provider, tags, metadata, published_at")
    .contains("related_model_ids", [model.id])
    .order("published_at", { ascending: false })
    .limit(20);
  // Also get provider-level news that isn't model-specific yet
  const { data: providerNewsRaw } = model.provider
    ? await supabase
        .from("model_news")
        .select("id, title, summary, url, source, category, related_provider, tags, metadata, published_at")
        .eq("related_provider", model.provider)
        .or("related_model_ids.is.null,related_model_ids.eq.{}")
        .order("published_at", { ascending: false })
        .limit(10)
    : { data: [] as typeof newsRaw };
  // Merge and deduplicate by id
  const seenNewsIds = new Set<string>();
  const modelNews: Record<string, unknown>[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const item of [...(newsRaw ?? []), ...((providerNewsRaw ?? []) as any[])]) {
    if (!seenNewsIds.has(item.id)) {
      seenNewsIds.add(item.id);
      modelNews.push(item as Record<string, unknown>);
    }
  }
  // Sort merged results by date
  modelNews.sort((a, b) =>
    new Date(b.published_at as string).getTime() - new Date(a.published_at as string).getTime()
  );

  const catConfig = CATEGORIES.find((c) => c.slug === model.category);
  const benchmarkScores = (model.benchmark_scores as {
    score: number;
    score_normalized: number | null;
    benchmarks: { name: string; slug: string; category: string; max_score: number | null } | null;
  }[]) ?? [];
  const pricingData = (model.model_pricing as {
    provider_name: string;
    input_price_per_million: number | null;
    output_price_per_million: number | null;
    median_output_tokens_per_second: number | null;
    median_time_to_first_token: number | null;
  }[]) ?? [];
  const updates = (model.model_updates as {
    title: string;
    description: string | null;
    update_type: string;
    published_at: string;
  }[]) ?? [];
  // Extract ELO ratings — pick the highest-scored entry if multiple exist
  const eloRatings = (model.elo_ratings as {
    arena_name: string;
    elo_score: number;
    rank: number | null;
    confidence_interval_low: number | null;
    confidence_interval_high: number | null;
    num_battles: number | null;
    snapshot_date: string | null;
  }[]) ?? [];
  const bestElo = eloRatings.length > 0
    ? eloRatings.reduce((best, curr) =>
        (curr.elo_score > best.elo_score ? curr : best), eloRatings[0])
    : null;
  const rawModalities = model.modalities;
  const modalities: string[] = Array.isArray(rawModalities)
    ? rawModalities
    : typeof rawModalities === "string"
      ? rawModalities.split(",").map((s: string) => s.trim()).filter(Boolean)
      : [];
  const rawCapabilities = model.capabilities;
  const capabilities: Record<string, boolean> =
    rawCapabilities && typeof rawCapabilities === "object" && !Array.isArray(rawCapabilities)
      ? (rawCapabilities as Record<string, boolean>)
      : {};

  // JSON-LD structured data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: model.name,
    description: model.description ?? model.short_description ?? undefined,
    applicationCategory: "Artificial Intelligence",
    operatingSystem: "Cloud",
    author: {
      "@type": "Organization",
      name: model.provider,
    },
    ...(model.release_date && { datePublished: model.release_date }),
    ...(model.quality_score && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: Number(model.quality_score).toFixed(1),
        bestRating: "100",
        worstRating: "0",
        ratingCount: model.hf_likes || 1,
      },
    }),
    ...(pricingData.length > 0 &&
      pricingData[0].input_price_per_million != null && {
        offers: {
          "@type": "Offer",
          price: pricingData
            .sort(
              (a: { input_price_per_million: number | null }, b: { input_price_per_million: number | null }) =>
                (a.input_price_per_million ?? 0) - (b.input_price_per_million ?? 0)
            )[0].input_price_per_million,
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
        },
      }),
    ...(model.is_open_weights && {
      license: model.license_name ?? "Open Source",
      isAccessibleForFree: true,
    }),
    url: `${SITE_URL}/models/${model.slug}`,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Back nav */}
      <Link
        href="/models"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Models
      </Link>

      {/* Header with gradient mesh background */}
      <div className="relative -mx-4 px-4 py-6 mb-2 rounded-2xl gradient-mesh">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold">{model.name}</h1>
            {model.overall_rank && (
              <Badge className="rank-badge text-sm text-neon font-bold">
                #{model.overall_rank}
              </Badge>
            )}
            {catConfig && (
              <Badge
                variant="outline"
                className="gap-1 border-transparent text-xs"
                style={{ backgroundColor: `${catConfig.color}15`, color: catConfig.color }}
              >
                <catConfig.icon className="h-3.5 w-3.5" />
                {catConfig.label}
              </Badge>
            )}
            {model.is_open_weights ? (
              <Badge variant="outline" className="border-gain/30 bg-gain/10 text-xs text-gain">
                Open Weights
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                Proprietary
              </Badge>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <ProviderLogo provider={model.provider} size="md" />
            <p className="text-lg text-muted-foreground">{model.provider}</p>
          </div>
          {model.description && (
            <p className="mt-4 max-w-3xl text-sm text-muted-foreground leading-relaxed">
              {model.description}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 md:flex-col">
          {model.website_url && (
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <a href={model.website_url} target="_blank" rel="noopener noreferrer">
                <Globe className="h-4 w-4" />
                Website
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          )}
          <ModelActions modelSlug={model.slug} modelName={model.name} modelId={model.id} />
          <ShareModel modelSlug={model.slug} modelName={model.name} provider={model.provider} />
        </div>
      </div>
      </div>

      {/* Quick Stats Row */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-7 stagger-enhanced">
        {[
          { label: "Quality Score", value: model.quality_score ? Number(model.quality_score).toFixed(1) : "—", icon: BarChart3 },
          { label: "Arena ELO", value: bestElo ? String(bestElo.elo_score) : "—", icon: Trophy },
          { label: "Parameters", value: model.parameter_count ? formatParams(model.parameter_count) : "—", icon: Zap },
          { label: "Context", value: model.context_window ? formatContextWindow(model.context_window) : "—", icon: MessageSquare },
          { label: "Downloads", value: formatNumber(model.hf_downloads), icon: Download },
          { label: "Likes", value: formatNumber(model.hf_likes), icon: Heart },
          { label: "Released", value: model.release_date ? new Date(model.release_date).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—", icon: Calendar },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/50 bg-card">
            <CardContent className="p-3 text-center">
              <stat.icon className="mx-auto h-4 w-4 text-neon mb-1" />
              <p className="text-lg font-bold">{stat.value}</p>
              <p className="text-[11px] text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Model Overview (AI-generated pros/cons) */}
      <div className="mt-8">
        <ModelOverview modelSlug={model.slug} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="benchmarks" className="mt-6">
        <TabsList className="bg-secondary/50 flex-wrap">
          <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="deploy">Deploy</TabsTrigger>
          <TabsTrigger value="trading">Trading</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="news">
            <Newspaper className="h-3.5 w-3.5 mr-1" />
            News{modelNews.length > 0 ? ` (${modelNews.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="changelog">Changelog</TabsTrigger>
        </TabsList>

        {/* Benchmarks Tab */}
        <TabsContent value="benchmarks" className="mt-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Benchmark Scores</CardTitle>
            </CardHeader>
            <CardContent>
              {benchmarkScores.length > 0 ? (
                <>
                  <div className="mb-8">
                    <BenchmarkRadar
                      scores={benchmarkScores.map((bs) => ({
                        benchmark: bs.benchmarks?.name ?? "Unknown",
                        score: Number(bs.score_normalized ?? bs.score),
                        maxScore: 100,
                      }))}
                    />
                  </div>
                  <div className="space-y-4">
                  {benchmarkScores.map((bs, i) => {
                    const maxScore = 100;
                    const score = Number(bs.score_normalized ?? bs.score);
                    return (
                      <div key={i} className="flex items-center gap-4">
                        <div className="w-28 shrink-0">
                          <span className="text-sm font-medium">{bs.benchmarks?.name ?? "Unknown"}</span>
                          <span className="ml-2 text-[10px] text-muted-foreground capitalize">{bs.benchmarks?.category ?? ""}</span>
                        </div>
                        <div className="flex-1">
                          <div className="relative h-3 overflow-hidden rounded-full bg-secondary">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-neon/70 to-neon animate-score-bar"
                              style={{ width: `${(score / maxScore) * 100}%`, animationDelay: `${i * 80}ms` }}
                            />
                          </div>
                        </div>
                        <span className="w-14 text-right text-sm font-bold tabular-nums">
                          {score.toFixed(1)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                </>
              ) : (
                <p className="text-center text-muted-foreground py-8">No benchmark data available yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Arena ELO Section */}
          {eloRatings.length > 0 && (
            <Card className="border-border/50 mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Swords className="h-5 w-5 text-neon" />
                  Arena ELO Ratings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {eloRatings.map((elo, i) => {
                    const ciLow = elo.confidence_interval_low;
                    const ciHigh = elo.confidence_interval_high;
                    const ciWidth = ciLow && ciHigh ? ciHigh - ciLow : null;
                    return (
                      <div key={i} className="rounded-lg border border-border/50 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Trophy className="h-4 w-4 text-[#f5a623]" />
                            <span className="text-sm font-medium capitalize">
                              {elo.arena_name.replace(/-/g, " ")}
                            </span>
                          </div>
                          {elo.rank && (
                            <Badge className="bg-neon/10 text-neon text-xs">
                              Arena Rank #{elo.rank}
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                          <div>
                            <p className="text-2xl font-bold tabular-nums">{elo.elo_score}</p>
                            <p className="text-[11px] text-muted-foreground">ELO Score</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium tabular-nums">
                              {ciLow && ciHigh
                                ? `${ciLow} — ${ciHigh}`
                                : "—"}
                            </p>
                            <p className="text-[11px] text-muted-foreground">95% Confidence</p>
                            {ciWidth != null && (
                              <p className="text-[10px] text-muted-foreground/60">
                                ±{(ciWidth / 2).toFixed(0)} points
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium tabular-nums">
                              {elo.num_battles ? formatNumber(elo.num_battles) : "—"}
                            </p>
                            <p className="text-[11px] text-muted-foreground">Battles</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium tabular-nums">
                              {elo.snapshot_date
                                ? new Date(elo.snapshot_date).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })
                                : "—"}
                            </p>
                            <p className="text-[11px] text-muted-foreground">Last Updated</p>
                          </div>
                        </div>
                        {/* ELO strength bar */}
                        <div className="mt-3">
                          <div className="relative h-2 overflow-hidden rounded-full bg-secondary">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#f5a623] to-neon transition-all duration-700"
                              style={{
                                width: `${Math.min(((elo.elo_score - 900) / 600) * 100, 100)}%`,
                              }}
                            />
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-[9px] text-muted-foreground/40">900</span>
                            <span className="text-[9px] text-muted-foreground/40">1200</span>
                            <span className="text-[9px] text-muted-foreground/40">1500</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Pricing Tab */}
        <TabsContent value="pricing" className="mt-6">
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
                            {p.input_price_per_million != null ? formatTokenPrice(p.input_price_per_million) : "—"}
                          </td>
                          <td className="px-4 py-3 text-right text-sm tabular-nums">
                            {p.output_price_per_million != null ? formatTokenPrice(p.output_price_per_million) : "—"}
                          </td>
                          <td className="hidden px-4 py-3 text-right text-sm tabular-nums text-muted-foreground sm:table-cell">
                            {p.median_output_tokens_per_second ? `${Number(p.median_output_tokens_per_second).toFixed(0)} tok/s` : "—"}
                          </td>
                          <td className="hidden px-4 py-3 text-right text-sm tabular-nums text-muted-foreground md:table-cell">
                            {p.median_time_to_first_token ? `${Number(p.median_time_to_first_token).toFixed(2)}s` : "—"}
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
        </TabsContent>

        {/* Deploy Tab */}
        <TabsContent value="deploy" className="mt-6">
          <DeployTab
            modelSlug={model.slug}
            modelName={model.name}
            isOpenWeights={!!model.is_open_weights}
          />
        </TabsContent>

        {/* Trading Tab */}
        <TabsContent value="trading" className="mt-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Popularity &amp; Market Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <TradingChart modelSlug={model.slug} />
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="text-center">
                  <p className="text-lg font-bold tabular-nums">
                    {model.popularity_rank ? `#${model.popularity_rank}` : "---"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Popularity Rank</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold tabular-nums">
                    {model.market_cap_estimate
                      ? `$${(Number(model.market_cap_estimate) / 1_000_000).toFixed(1)}M`
                      : "---"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Est. Market Cap</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold tabular-nums">
                    {model.agent_score ? Number(model.agent_score).toFixed(1) : "---"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Agent Score</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold tabular-nums">
                    {model.github_stars ? formatNumber(model.github_stars) : "---"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">GitHub Stars</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="mt-6">
          {snapshots.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Quality Score Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <QualityTrend
                    snapshots={snapshots.map((s: any) => ({
                      snapshot_date: s.snapshot_date,
                      quality_score: s.quality_score,
                    }))}
                  />
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Downloads Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <DownloadsTrend
                    snapshots={snapshots.map((s: any) => ({
                      snapshot_date: s.snapshot_date,
                      hf_downloads: s.hf_downloads,
                    }))}
                  />
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="border-border/50">
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">No historical trend data available yet.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* News Tab */}
        <TabsContent value="news" className="mt-6">
          {modelNews.length > 0 ? (
            <div className="space-y-4">
              {/* Group by source type */}
              {(() => {
                const socialItems = modelNews.filter((n) =>
                  ["x-twitter", "provider-blog"].includes(n.source as string)
                );
                const researchItems = modelNews.filter((n) =>
                  ["arxiv", "hf-papers"].includes(n.source as string)
                );
                const benchmarkItems = modelNews.filter((n) =>
                  ["artificial-analysis", "open-llm-leaderboard"].includes(n.source as string)
                );
                const otherItems = modelNews.filter(
                  (n) =>
                    !["x-twitter", "provider-blog", "arxiv", "hf-papers", "artificial-analysis", "open-llm-leaderboard"].includes(
                      n.source as string
                    )
                );

                return (
                  <>
                    {socialItems.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                          Social & Blog Posts
                          <Badge variant="secondary" className="text-[10px]">{socialItems.length}</Badge>
                        </h3>
                        <div className="space-y-3">
                          {socialItems.map((item) => (
                            <NewsCard key={item.id as string} item={item} />
                          ))}
                        </div>
                      </div>
                    )}
                    {benchmarkItems.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                          Benchmarks & Rankings
                          <Badge variant="secondary" className="text-[10px]">{benchmarkItems.length}</Badge>
                        </h3>
                        <div className="space-y-3">
                          {benchmarkItems.map((item) => (
                            <NewsCard key={item.id as string} item={item} />
                          ))}
                        </div>
                      </div>
                    )}
                    {researchItems.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                          Research Papers
                          <Badge variant="secondary" className="text-[10px]">{researchItems.length}</Badge>
                        </h3>
                        <div className="space-y-3">
                          {researchItems.map((item) => (
                            <NewsCard key={item.id as string} item={item} />
                          ))}
                        </div>
                      </div>
                    )}
                    {otherItems.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-muted-foreground mb-3">Other</h3>
                        <div className="space-y-3">
                          {otherItems.map((item) => (
                            <NewsCard key={item.id as string} item={item} />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          ) : (
            <Card className="border-border/50">
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">
                  No news linked to this model yet. News is automatically linked during data sync.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Code className="h-5 w-5 text-neon" />
                  Technical Specs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Architecture", value: model.architecture ?? "—" },
                  { label: "Parameters", value: model.parameter_count ? formatParams(model.parameter_count) : "—" },
                  { label: "Context Window", value: model.context_window ? formatContextWindow(model.context_window) : "—" },
                  { label: "Release Date", value: model.release_date ? new Date(model.release_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-1">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <span className="text-sm font-medium">{item.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="h-5 w-5 text-neon" />
                  License & Access
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "License", value: model.license_name ?? model.license ?? "—" },
                  { label: "Open Weights", value: model.is_open_weights ? "Yes" : "No" },
                  { label: "API Available", value: model.is_api_available ? "Yes" : "No" },
                  { label: "Modalities", value: modalities.length > 0 ? modalities.join(", ") : "—" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-1">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <span className="text-sm font-medium">{item.value}</span>
                  </div>
                ))}
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Capabilities</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(capabilities)
                      .filter(([, v]) => v)
                      .map(([key]) => (
                        <Badge key={key} variant="outline" className="text-[11px]">
                          {key.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    {Object.keys(capabilities).length === 0 && (
                      <span className="text-xs text-muted-foreground">No capabilities listed</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Changelog Tab */}
        <TabsContent value="changelog" className="mt-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Recent Updates</CardTitle>
            </CardHeader>
            <CardContent>
              {updates.length > 0 ? (
                <div className="space-y-6">
                  {updates.map((update, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="h-2.5 w-2.5 rounded-full bg-neon" />
                        {i < updates.length - 1 && <div className="flex-1 w-px bg-border/50 mt-1" />}
                      </div>
                      <div className="flex-1 pb-2">
                        <p className="text-xs text-muted-foreground">
                          {new Date(update.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                        <p className="text-sm font-semibold mt-0.5">{update.title}</p>
                        {update.description && (
                          <p className="text-xs text-muted-foreground mt-1">{update.description}</p>
                        )}
                        <Badge variant="outline" className="mt-2 text-[10px]">
                          {update.update_type.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No updates recorded yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Similar Models */}
      {similarModels.length > 0 && (
        <div className="mt-8">
          <Card className="border-border/50">
            <CardContent className="p-6">
              <SimilarModels
                models={similarModels}
                currentCategory={model.category}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Comments */}
      <CommentsSection modelId={model.id} />
    </div>
  );
}
