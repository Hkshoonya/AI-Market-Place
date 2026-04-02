import type { Metadata } from "next";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Flame,
  Layers,
  Rocket,
  Scale,
  Server,
  Shuffle,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CATEGORIES } from "@/lib/constants/categories";
import { createOptionalPublicClient } from "@/lib/supabase/public-server";
import { parseQueryResult } from "@/lib/schemas/parse";
import { HomeTopModelSchema } from "@/lib/schemas/models";
import { formatNumber } from "@/lib/format";
import { HeroSection } from "@/components/hero-section";
import { ProviderLogo } from "@/components/shared/provider-logo";
import { MarketValueBadge } from "@/components/models/market-value-badge";
import { getCanonicalProviderName, getProviderBrand } from "@/lib/constants/providers";
import { SITE_NAME, SITE_DESCRIPTION, SITE_URL } from "@/lib/constants/site";
import { CountUp } from "@/components/ui/count-up";
import { countMarketValueEvidence } from "@/lib/models/market-value";
import { dedupePublicModelFamilies } from "@/lib/models/public-families";
import { getParameterDisplay } from "@/lib/models/presentation";
import { getPublicPricingSummary } from "@/lib/models/pricing";
import {
  buildAccessOffersCatalog,
  getBestAccessOfferForModel,
} from "@/lib/models/access-offers";
import { getDeployabilityLabel } from "@/lib/models/deployability";
import { TopSubscriptionProviders } from "@/components/home/top-subscription-providers";
import { DataFreshnessBadge } from "@/components/shared/data-freshness-badge";
import { createOptionalAdminClient } from "@/lib/supabase/admin";
import { buildHomepageLaunchSelections } from "@/lib/homepage/launches";
import { buildHomepageDeploymentSelections } from "@/lib/homepage/deployments";
import { selectHomepageTopModelIds } from "@/lib/homepage/top-models";

const TopMovers = dynamic(() => import("@/components/charts/top-movers"), {
  loading: () => <div className="h-[400px] animate-pulse rounded-xl bg-card" />,
});

const QualityPriceFrontier = dynamic(
  () => import("@/components/charts/quality-price-frontier"),
  { loading: () => <div className="h-[500px] animate-pulse rounded-xl bg-card" /> }
);

const ProviderMarketShare = dynamic(
  () =>
    import("@/components/charts/provider-market-share").then((module) => ({
      default: module.ProviderMarketShare,
    })),
  { loading: () => <div className="h-[350px] animate-pulse rounded-xl bg-card" /> }
);

const CategoryDistribution = dynamic(
  () =>
    import("@/components/charts/category-distribution").then((module) => ({
      default: module.CategoryDistribution,
    })),
  { loading: () => <div className="h-[350px] animate-pulse rounded-xl bg-card" /> }
);

const TrendingModels = dynamic(
  () =>
    import("@/components/models/trending-models").then((module) => ({
      default: module.TrendingModels,
    })),
  { loading: () => <div className="h-[400px] animate-pulse rounded-xl bg-card" /> }
);

export const metadata: Metadata = {
  title: `${SITE_NAME} - Track, Compare & Discover AI Models`,
  description: SITE_DESCRIPTION,
  openGraph: {
    title: `${SITE_NAME} - Track, Compare & Discover AI Models`,
    description: SITE_DESCRIPTION,
    type: "website",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} - Track, Compare & Discover AI Models`,
    description: SITE_DESCRIPTION,
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export const revalidate = 300;

function getRelativeDateLabel(value: string | null, now: number) {
  if (!value) return "";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "";

  const daysAgo = Math.floor((now - timestamp) / (1000 * 60 * 60 * 24));
  if (daysAgo <= 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo < 7) return `${daysAgo} days ago`;
  if (daysAgo < 30) {
    const weeksAgo = Math.floor(daysAgo / 7);
    return `${weeksAgo} week${weeksAgo > 1 ? "s" : ""} ago`;
  }

  const monthsAgo = Math.floor(daysAgo / 30);
  return `${monthsAgo} month${monthsAgo > 1 ? "s" : ""} ago`;
}

function getDeploymentUpdateBadgeLabel(source: string | null, signalType: "api" | "open_source") {
  if (signalType === "open_source") return "Run Yourself";
  return "Use It";
}

export default async function HomePage() {
  const supabase = createOptionalPublicClient() ?? createOptionalAdminClient();
  // eslint-disable-next-line react-hooks/purity -- server component runs once per request, not a repeated render cycle; Date.now() is stable for this response
  const now = Date.now();

  const [
    { count: modelCount },
    { count: benchmarkCount },
    { data: allActiveModels },
    { data: deploymentPlatformsRaw },
    { data: modelDeploymentsRaw },
    { data: latestSignalNewsRaw },
    { data: recentLaunchNewsRaw },
    { data: recentDeploymentNewsRaw },
    { data: latestPipelineSyncRaw },
  ] = supabase
    ? await Promise.all([
        supabase.from("models").select("*", { count: "exact", head: true }),
        supabase.from("benchmarks").select("*", { count: "exact", head: true }),
        supabase
          .from("models")
          .select(
            "id, slug, name, provider, category, overall_rank, quality_score, capability_score, capability_rank, popularity_score, popularity_rank, adoption_score, adoption_rank, economic_footprint_score, economic_footprint_rank, market_cap_estimate, agent_score, hf_downloads, hf_likes, release_date, created_at, parameter_count, short_description, description, context_window, is_open_weights"
          )
          .eq("status", "active"),
        supabase
          .from("deployment_platforms")
          .select("*")
          .order("name"),
        supabase
          .from("model_deployments")
          .select("id, model_id, platform_id, pricing_model, price_per_unit, unit_description, free_tier, one_click, status")
          .eq("status", "available"),
        supabase
          .from("model_news")
          .select("published_at")
          .in("source", ["x-twitter", "provider-blog"])
          .order("published_at", { ascending: false })
          .limit(1),
        supabase
          .from("model_news")
          .select("source, published_at, related_provider, related_model_ids, metadata, category")
          .in("source", ["x-twitter", "provider-blog"])
          .not("related_model_ids", "is", null)
          .gte("published_at", new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString())
          .order("published_at", { ascending: false })
          .limit(200),
        supabase
          .from("model_news")
          .select(
            "title, summary, source, published_at, related_provider, related_model_ids, metadata, category"
          )
          .in("source", ["provider-deployment-signals", "ollama-library"])
          .not("related_model_ids", "is", null)
          .gte("published_at", new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString())
          .order("published_at", { ascending: false })
          .limit(200),
        supabase
          .from("data_sources")
          .select("last_sync_at")
          .eq("is_enabled", true)
          .is("quarantined_at", null)
          .not("last_sync_at", "is", null)
          .order("last_sync_at", { ascending: false })
          .limit(1),
      ])
    : [
        { count: 0 },
        { count: 0 },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
      ];

  const activeModels = dedupePublicModelFamilies(allActiveModels ?? []);
  const deploymentPlatforms = (deploymentPlatformsRaw ?? []).map((platform) => {
    const platformRecord = platform as Record<string, unknown>;

    return {
      id: platform.id,
      slug: platform.slug,
      name: platform.name,
      type: platform.type,
      base_url: platform.base_url,
      has_affiliate: platform.has_affiliate,
      affiliate_url:
        typeof platformRecord.affiliate_url === "string"
          ? platformRecord.affiliate_url
          : platform.affiliate_url_template,
      affiliate_tag:
        typeof platformRecord.affiliate_tag === "string"
          ? platformRecord.affiliate_tag
          : null,
    };
  });
  const accessOffers = buildAccessOffersCatalog({
    platforms: deploymentPlatforms,
    deployments: modelDeploymentsRaw ?? [],
    models: activeModels,
  });
  const latestLaunchSignalAt =
    typeof latestSignalNewsRaw?.[0]?.published_at === "string"
      ? latestSignalNewsRaw[0].published_at
      : null;
  const latestPipelineSyncAt =
    typeof latestPipelineSyncRaw?.[0]?.last_sync_at === "string"
      ? latestPipelineSyncRaw[0].last_sync_at
      : null;
  const marketSignalsRefreshedAt = latestPipelineSyncAt ?? latestLaunchSignalAt;

  const topModelIds = selectHomepageTopModelIds(activeModels, 10);

  const topModelsResponse =
    supabase && topModelIds.length > 0
      ? await supabase
          .from("models")
          .select("*, rankings(*), model_pricing(*), benchmark_scores(benchmark_id, benchmarks(slug)), elo_ratings(arena_name)")
          .in("id", topModelIds)
      : { data: [], error: null };

  const topModelsById = new Map(
    parseQueryResult(topModelsResponse, HomeTopModelSchema, "HomeTopModel").map((model) => [
      model.id,
      model,
    ])
  );
  const topModels = topModelIds
    .map((id) => topModelsById.get(id))
    .filter((model): model is NonNullable<typeof model> => Boolean(model));

  const newModels = buildHomepageLaunchSelections(
    (allActiveModels ?? []) as Parameters<typeof buildHomepageLaunchSelections>[0],
    ((recentLaunchNewsRaw ?? []) as Array<Record<string, unknown>>).map((item) => ({
      source: typeof item.source === "string" ? item.source : null,
      published_at: typeof item.published_at === "string" ? item.published_at : null,
      related_provider:
        typeof item.related_provider === "string" ? item.related_provider : null,
      related_model_ids: Array.isArray(item.related_model_ids)
        ? (item.related_model_ids as string[])
        : null,
      metadata:
        item.metadata && typeof item.metadata === "object"
          ? (item.metadata as Record<string, unknown>)
          : null,
      category: typeof item.category === "string" ? item.category : null,
    })),
    4,
    now
  );
  const newDeploymentPaths = buildHomepageDeploymentSelections(
    (allActiveModels ?? []) as Parameters<typeof buildHomepageDeploymentSelections>[0],
    ((recentDeploymentNewsRaw ?? []) as Array<Record<string, unknown>>).map((item) => ({
      title: typeof item.title === "string" ? item.title : null,
      summary: typeof item.summary === "string" ? item.summary : null,
      source: typeof item.source === "string" ? item.source : null,
      published_at: typeof item.published_at === "string" ? item.published_at : null,
      related_provider:
        typeof item.related_provider === "string" ? item.related_provider : null,
      related_model_ids: Array.isArray(item.related_model_ids)
        ? (item.related_model_ids as string[])
        : null,
      metadata:
        item.metadata && typeof item.metadata === "object"
          ? (item.metadata as Record<string, unknown>)
          : null,
      category: typeof item.category === "string" ? item.category : null,
    })),
    4,
    now
  );

  // Derive all aggregates from the single query result
  const uniqueProviders = new Set(activeModels.map((m) => m.provider)).size;
  const categoryCount = new Set(activeModels.map((m) => m.category).filter(Boolean)).size;

  const totalDownloads = activeModels.reduce(
    (sum, m) => sum + (Number(m.hf_downloads) || 0),
    0
  );
  const totalLikes = activeModels.reduce(
    (sum, m) => sum + (Number(m.hf_likes) || 0),
    0
  );

  const openWeightCount = activeModels.filter((m) => m.is_open_weights).length;

  const qualityScores = activeModels
    .filter((m) => m.quality_score != null)
    .map((m) => Number(m.quality_score));
  const avgQualityScore =
    qualityScores.length > 0
      ? qualityScores.reduce((sum, s) => sum + s, 0) / qualityScores.length
      : 0;

  // Derive provider & category chart data from consolidated query
  const providerMap = new Map<string, number>();
  const categoryMap = new Map<string, number>();
  for (const m of activeModels) {
    const canonicalProvider = getCanonicalProviderName(m.provider);
    providerMap.set(canonicalProvider, (providerMap.get(canonicalProvider) ?? 0) + 1);
    if (m.category) categoryMap.set(m.category, (categoryMap.get(m.category) ?? 0) + 1);
  }

  const providerChartData = Array.from(providerMap.entries())
    .map(([provider, count]) => ({
      provider,
      count,
      color: getProviderBrand(provider)?.color ?? "#666",
    }))
    .sort((a, b) => b.count - a.count);

  const categoryChartData = Array.from(categoryMap.entries())
    .map(([cat, count]) => {
      const config = CATEGORIES.find((c) => c.slug === cat);
      return {
        category: config?.shortLabel ?? cat,
        count,
        color: config?.color ?? "#666",
      };
    })
    .sort((a, b) => b.count - a.count);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <div className="relative">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      {/* 3D Hero Section â€” Client Component Island */}
      <HeroSection
        stats={{
          modelCount: modelCount ?? 0,
          categoryCount: categoryCount || 0,
          providerCount: uniqueProviders,
          benchmarkCount: benchmarkCount ?? 0,
          totalDownloads,
          totalLikes,
        }}
      />

      <div className="mx-auto mt-6 max-w-7xl px-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-border/50 bg-card/50 p-4 md:flex-row md:items-center md:justify-between">
          <DataFreshnessBadge
            label="Market signals refreshed"
            timestamp={marketSignalsRefreshedAt}
            detail={latestPipelineSyncAt ? "pipeline sync" : "market updates"}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/news"
              className="inline-flex items-center gap-1 text-sm font-medium text-neon hover:underline"
            >
              Explore live updates
              <ArrowRight className="h-4 w-4" />
            </Link>
            <span className="text-xs text-muted-foreground">
              Launches, pricing, benchmarks, and API changes live in the dedicated updates page.
            </span>
          </div>
        </div>
      </div>

      {/* Top 10 Leaderboard */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-neon" />
            <h2 className="text-xl font-bold">Top AI Models</h2>
          </div>
          <Button variant="ghost" size="sm" className="text-neon" asChild>
            <Link href="/leaderboards">
              View All <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          Ranked for enterprise traction, real-world adoption, economic footprint, and model quality.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Start here if you want the short list of models that matter most right now.
        </p>

        <div className="mt-6 overflow-x-auto rounded-xl border border-border/50">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/30">
                <th className="w-12 px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Model
                </th>
                <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
                  Category
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground whitespace-nowrap">
                  Est. Market Value
                </th>
                <th className="hidden md:table-cell px-4 py-3 text-right text-xs font-medium text-muted-foreground whitespace-nowrap">
                  Popularity
                </th>
                <th className="hidden lg:table-cell px-4 py-3 text-right text-xs font-medium text-muted-foreground whitespace-nowrap">
                  Quality
                </th>
                <th className="hidden xl:table-cell px-4 py-3 text-right text-xs font-medium text-muted-foreground whitespace-nowrap">
                  Cheapest Verified
                </th>
              </tr>
            </thead>
            <tbody>
              {topModels.map((model, index) => {
                const catConfig = CATEGORIES.find(
                  (c) => c.slug === model.category
                );
                const rank = index + 1;
                const economicFootprint =
                  model.economic_footprint_score != null
                    ? Number(model.economic_footprint_score)
                    : null;
                const popScore = model.popularity_score != null ? Number(model.popularity_score) : null;
                const pricingSummary = getPublicPricingSummary({
                  id: model.id,
                  slug: model.slug,
                  name: model.name,
                  provider: model.provider,
                  overall_rank: model.overall_rank,
                  is_open_weights: model.is_open_weights,
                  model_pricing: model.model_pricing,
                });
                const evidence = countMarketValueEvidence({
                  benchmarkScores: model.benchmark_scores,
                  eloRatings: model.elo_ratings,
                  pricingEntries: model.model_pricing,
                });
                const deploymentLabel = getDeployabilityLabel({
                  isOpenWeights: model.is_open_weights,
                  accessOffer: getBestAccessOfferForModel(accessOffers, model.id),
                });

                return (
                  <tr
                    key={model.id}
                    className="border-b border-border/30 table-row-hover cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <Link href={`/models/${model.slug}`} className="block">
                        <span
                          className={`text-sm font-bold tabular-nums ${
                            rank <= 3 ? "text-neon" : "text-muted-foreground"
                          }`}
                        >
                          {rank}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/models/${model.slug}`} className="block">
                        <div className="flex items-center gap-2">
                          <ProviderLogo provider={model.provider} size="sm" className="shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold hover:text-neon transition-colors line-clamp-1 break-all">
                              {model.name}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {model.provider}
                            </p>
                            {deploymentLabel ? (
                              <Badge
                                variant="outline"
                                className="mt-1 border-cyan-500/30 bg-cyan-500/10 text-[10px] text-cyan-200"
                              >
                                {deploymentLabel}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <Link href={`/models/${model.slug}`} className="block">
                        {catConfig && (
                          <Badge
                            variant="outline"
                            className="gap-1 border-transparent text-[11px]"
                            style={{
                              backgroundColor: `${catConfig.color}15`,
                              color: catConfig.color,
                            }}
                          >
                            <catConfig.icon className="h-3 w-3" />
                            {catConfig.shortLabel}
                          </Badge>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex justify-end">
                        <MarketValueBadge
                          className="min-w-32"
                          supportingText={`Footprint ${economicFootprint != null ? economicFootprint.toFixed(1) : "---"}`}
                          marketCapEstimate={model.market_cap_estimate}
                          popularityScore={model.popularity_score}
                          adoptionScore={model.adoption_score}
                          economicFootprintScore={model.economic_footprint_score}
                          capabilityScore={model.quality_score}
                          agentScore={model.agent_score}
                          benchmarkCount={evidence.benchmarkCount}
                          arenaFamilyCount={evidence.arenaFamilyCount}
                          pricingSourceCount={evidence.pricingSourceCount}
                        />
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-right whitespace-nowrap md:table-cell">
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
                    <td className="hidden px-4 py-3 text-right whitespace-nowrap lg:table-cell">
                      <Link href={`/models/${model.slug}`} className="block">
                        <span className="text-sm font-semibold tabular-nums">
                          {model.quality_score
                            ? Number(model.quality_score).toFixed(1)
                            : "—"}
                        </span>
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 text-right text-sm whitespace-nowrap xl:table-cell">
                      <Link href={`/models/${model.slug}`} className="block">
                        {pricingSummary.compactDisplay ? (
                          <div className="space-y-0.5 text-right text-muted-foreground">
                            <div>
                              {pricingSummary.compactDisplay}
                            </div>
                            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
                              {pricingSummary.compactLabel}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Market Overview */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="flex items-center gap-3 mb-6">
          <Scale className="h-5 w-5 text-neon" />
          <h2 className="text-xl font-bold">Market Overview</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-enhanced">
          <Card className="border-border/50 glass-card">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Total Models</p>
              <p className="text-3xl font-bold mt-1">
                <CountUp
                  end={activeModels.length > 0 ? activeModels.length : (modelCount ?? 0)}
                  className="text-3xl font-bold"
                />
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                across {uniqueProviders} providers
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/50 glass-card">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Avg Quality Score</p>
              <p className="text-3xl font-bold mt-1 text-neon">
                <CountUp end={avgQualityScore} decimals={1} className="text-3xl font-bold text-neon" />
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                out of 100 across {qualityScores.length} models
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/50 glass-card">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Open Weight Models</p>
              <p className="text-3xl font-bold mt-1">
                <CountUp end={openWeightCount ?? 0} className="text-3xl font-bold" />
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {activeModels.length ? ((((openWeightCount ?? 0) / activeModels.length) * 100).toFixed(0)) : 0}% of tracked models
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/50 glass-card">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Total Downloads</p>
              <p className="text-3xl font-bold mt-1">{formatNumber(totalDownloads)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatNumber(totalLikes)} community likes
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* New Launches */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Rocket className="h-5 w-5 text-neon" />
            <h2 className="text-xl font-bold">New Launches</h2>
          </div>
          <Button variant="ghost" size="sm" className="text-neon" asChild>
            <Link href="/models">
              View All <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          Recently launched or newly surfaced models from tracked providers and official release signals.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {newModels?.map(({ model, surfacedAt }) => {
            const catConfig = CATEGORIES.find(
              (c) => c.slug === model.category
            );
            const parameterDisplay = getParameterDisplay(model);
            const surfaceDateValue = surfacedAt ?? model.release_date ?? null;
            const dateLabel = getRelativeDateLabel(surfaceDateValue, now);
            const deploymentLabel = getDeployabilityLabel({
              isOpenWeights: model.is_open_weights,
              accessOffer: getBestAccessOfferForModel(accessOffers, model.id),
            });

            return (
              <Link key={model.id} href={`/models/${model.slug}`}>
                <Card className="group border-border/50 bg-card transition-all hover:border-neon/30 hover:glow-neon h-full">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className="border-gain/30 bg-gain/10 text-[11px] text-gain"
                      >
                        NEW
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {dateLabel}
                      </span>
                    </div>
                    <h3 className="mt-3 text-sm font-semibold group-hover:text-neon transition-colors">
                      {model.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <ProviderLogo provider={model.provider} size="sm" />
                      <p className="text-xs text-muted-foreground">
                        {model.provider}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      {catConfig && (
                        <Badge
                          variant="outline"
                          className="gap-1 border-transparent text-[11px]"
                          style={{
                            backgroundColor: `${catConfig.color}15`,
                            color: catConfig.color,
                          }}
                        >
                          <catConfig.icon className="h-3 w-3" />
                          {catConfig.shortLabel}
                        </Badge>
                      )}
                      <div className="flex items-center gap-2">
                        {deploymentLabel ? (
                          <Badge
                            variant="outline"
                            className="border-cyan-500/30 bg-cyan-500/10 text-[11px] text-cyan-200"
                          >
                            {deploymentLabel}
                          </Badge>
                        ) : null}
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Zap className="h-3 w-3 text-neon" />
                          {parameterDisplay.label}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {newDeploymentPaths.length > 0 ? (
        <section className="mx-auto max-w-7xl px-4 py-12">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Server className="h-5 w-5 text-neon" />
              <h2 className="text-xl font-bold">New Ways to Use Models</h2>
            </div>
            <Button variant="ghost" size="sm" className="text-neon" asChild>
              <Link href="/news">
                View All <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <p className="mt-3 text-sm text-muted-foreground">
            This section tracks new ways a model became usable, such as use on AI Market Cap,
            new provider access, or new self-host support.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {newDeploymentPaths.map(({ model, surfacedAt, title, summary, source, signalType }) => {
              const catConfig = CATEGORIES.find((c) => c.slug === model.category);
              const parameterDisplay = getParameterDisplay(model);
              const dateLabel = getRelativeDateLabel(surfacedAt, now);

              return (
                <Link key={`${model.id}-${source ?? "deployment"}`} href={`/models/${model.slug}`}>
                  <Card className="group border-border/50 bg-card transition-all hover:border-neon/30 hover:glow-neon h-full">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <Badge
                          variant="outline"
                          className="border-neon/30 bg-neon/10 text-[11px] text-neon"
                        >
                          {getDeploymentUpdateBadgeLabel(source, signalType)}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">{dateLabel}</span>
                      </div>
                      <h3 className="mt-3 text-sm font-semibold group-hover:text-neon transition-colors">
                        {model.name}
                      </h3>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <ProviderLogo provider={model.provider} size="sm" />
                        <p className="text-xs text-muted-foreground">{model.provider}</p>
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm text-foreground/90">{title}</p>
                      <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                        {summary ?? "A new verified way to use this model is now available."}
                      </p>
                      <div className="mt-3 flex items-center justify-between">
                        {catConfig ? (
                          <Badge
                            variant="outline"
                            className="gap-1 border-transparent text-[11px]"
                            style={{
                              backgroundColor: `${catConfig.color}15`,
                              color: catConfig.color,
                            }}
                          >
                            <catConfig.icon className="h-3 w-3" />
                            {catConfig.shortLabel}
                          </Badge>
                        ) : (
                          <span />
                        )}
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Zap className="h-3 w-3 text-neon" />
                          {parameterDisplay.label}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Dashboard Row: Top Movers + Trending */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Movers â€” biggest rank changes */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Shuffle className="h-5 w-5 text-neon" />
              <h2 className="text-xl font-bold">Top Movers</h2>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Models with the biggest recent ranking changes.
            </p>
            <TopMovers />
          </div>

          {/* Trending Models */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Flame className="h-5 w-5 text-neon" />
                <h2 className="text-xl font-bold">Trending Models</h2>
              </div>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              The models people are actively searching for and opening now.
            </p>
            <Card className="border-border/50 bg-card">
              <CardContent className="p-4">
                <TrendingModels limit={8} />
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Quality vs Price Frontier â€” Interactive Scatter */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-neon" />
            <h2 className="text-xl font-bold">Quality vs Price Frontier</h2>
          </div>
          <Button variant="ghost" size="sm" className="text-neon" asChild>
            <Link href="/leaderboards?tab=frontier">
              Explore <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Use this chart to find models that give strong results without overspending.
        </p>
        <QualityPriceFrontier />
      </section>

      {/* Market Analytics: Provider + Category Distribution */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <h2 className="text-xl font-bold mb-6">Market Analytics</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          These charts show where model supply is concentrated by provider and by category.
        </p>
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-border/50 bg-card">
            <CardHeader>
              <CardTitle className="text-lg">Provider Market Share</CardTitle>
            </CardHeader>
            <CardContent>
              <ProviderMarketShare data={providerChartData} />
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card">
            <CardHeader>
              <CardTitle className="text-lg">Models by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <CategoryDistribution data={categoryChartData} />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Subscription Access Leaders */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="mb-6">
          <h2 className="text-xl font-bold">Best Subscription Access</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            If you want a paid plan instead of raw API billing, start here.
          </p>
        </div>
        <TopSubscriptionProviders offers={accessOffers.subscriptionOffers.slice(0, 6)} />
      </section>

      {/* Categories Grid */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="flex items-center gap-3">
          <Layers className="h-5 w-5 text-neon" />
          <h2 className="text-xl font-bold">Browse by Category</h2>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3">
          {CATEGORIES.map((cat) => (
            <Link key={cat.slug} href={`/models?category=${cat.slug}`}>
              <Card className="group border-border/50 bg-card transition-all hover:border-neon/30 hover:glow-neon">
                <CardContent className="flex items-center gap-4 p-4">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${cat.color}15` }}
                  >
                    <cat.icon
                      className="h-6 w-6"
                      style={{ color: cat.color }}
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold group-hover:text-neon transition-colors">
                      {cat.label}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {cat.description}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-neon transition-colors" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <Card className="relative overflow-hidden border-neon/20 bg-gradient-to-r from-neon/5 via-neon/10 to-neon/5">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-neon/5 to-transparent" />
          <CardContent className="relative flex flex-col items-center p-8 text-center md:p-12">
            <h2 className="text-2xl font-bold md:text-3xl">
              List your AI model on the marketplace
            </h2>
            <p className="mt-3 max-w-lg text-muted-foreground">
              Reach thousands of developers and businesses looking for AI
              models. Sell API access, fine-tuned models, datasets, and more.
            </p>
            <Button
              size="lg"
              className="mt-6 bg-neon text-background font-semibold hover:bg-neon/90"
              asChild
            >
              <Link href="/sell" prefetch={false}>
                Start Selling
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
