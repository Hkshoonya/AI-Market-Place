import type { Metadata } from "next";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CircleHelp,
  Flame,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CATEGORIES } from "@/lib/constants/categories";
import { createOptionalPublicClient } from "@/lib/supabase/public-server";
import { parseQueryResult } from "@/lib/schemas/parse";
import { HomeTopModelSchema } from "@/lib/schemas/models";
import { formatDate, formatNumber, formatRelativeTimeAt } from "@/lib/format";
import { HeroSection } from "@/components/hero-section";
import { ProviderLogo } from "@/components/shared/provider-logo";
import { MarketValueBadge } from "@/components/models/market-value-badge";
import { SITE_NAME, SITE_DESCRIPTION, SITE_URL } from "@/lib/constants/site";
import { CountUp } from "@/components/ui/count-up";
import { countMarketValueEvidence } from "@/lib/models/market-value";
import { dedupePublicModelFamilies } from "@/lib/models/public-families";
import { preferDefaultPublicSurfaceReady } from "@/lib/models/public-surface-readiness";
import { getParameterDisplay } from "@/lib/models/presentation";
import { getModelUpgradeHighlight } from "@/lib/models/upgrade-highlights";
import { getPublicPricingSummary } from "@/lib/models/pricing";
import {
  buildAccessOffersCatalog,
  getBestAccessOfferForModel,
} from "@/lib/models/access-offers";
import {
  getDeployabilityLabel,
  getUsageUpdateBadgeLabel,
} from "@/lib/models/deployability";
import { createOptionalAdminClient } from "@/lib/supabase/admin";
import { buildHomepageLaunchSelections } from "@/lib/homepage/launches";
import { buildHomepageDeploymentSelections } from "@/lib/homepage/deployments";
import { fetchAllHomepageActiveModels } from "@/lib/homepage/fetch-active-models";
import { selectHomepageTopModelIds } from "@/lib/homepage/top-models";
import {
  getCoreSourceRefreshTimestamp,
  HOMEPAGE_CORE_SOURCE_SLUGS,
} from "@/lib/homepage/source-freshness";
import { HomepageMoverStrip } from "@/components/home/homepage-mover-strip";

const TopMovers = dynamic(() => import("@/components/charts/top-movers"), {
  loading: () => <div className="h-[400px] animate-pulse rounded-xl bg-card" />,
});

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

export default async function HomePage() {
  const supabase = createOptionalPublicClient() ?? createOptionalAdminClient();
  // eslint-disable-next-line react-hooks/purity -- server component runs once per request, not a repeated render cycle; Date.now() is stable for this response
  const now = Date.now();

  const allActiveModelsPromise = supabase
    ? fetchAllHomepageActiveModels(
        supabase as unknown as Parameters<typeof fetchAllHomepageActiveModels>[0]
      ).catch((error) => {
        console.warn("homepage active models query failed", error);
        return [];
      })
    : Promise.resolve([]);

  const [
    allActiveModels,
    { count: modelCount },
    { count: benchmarkCount },
    { data: deploymentPlatformsRaw },
    { data: modelDeploymentsRaw },
    { data: latestSignalNewsRaw },
    { data: recentLaunchNewsRaw },
    { data: recentDeploymentNewsRaw },
    { data: coreSourceFreshnessRaw },
  ] = supabase
    ? await Promise.all([
        allActiveModelsPromise,
        supabase.from("models").select("*", { count: "exact", head: true }),
        supabase.from("benchmarks").select("*", { count: "exact", head: true }),
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
          .select("slug, last_success_at, last_sync_at")
          .eq("is_enabled", true)
          .is("quarantined_at", null)
          .in("slug", [...HOMEPAGE_CORE_SOURCE_SLUGS]),
      ])
    : await Promise.all([
        allActiveModelsPromise,
        Promise.resolve({ count: 0 }),
        Promise.resolve({ count: 0 }),
        Promise.resolve({ data: [] }),
        Promise.resolve({ data: [] }),
        Promise.resolve({ data: [] }),
        Promise.resolve({ data: [] }),
        Promise.resolve({ data: [] }),
        Promise.resolve({ data: [] }),
      ]);

  const homepageActiveModels =
    (allActiveModels ?? []) as unknown as Parameters<typeof dedupePublicModelFamilies>[0];
  const activeModels = preferDefaultPublicSurfaceReady(
    dedupePublicModelFamilies(homepageActiveModels),
    12
  );
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
    models: activeModels as Parameters<typeof buildAccessOffersCatalog>[0]["models"],
  });
  const latestLaunchSignalAt =
    typeof latestSignalNewsRaw?.[0]?.published_at === "string"
      ? latestSignalNewsRaw[0].published_at
      : null;
  const coreSourcesRefreshedAt = getCoreSourceRefreshTimestamp(
    coreSourceFreshnessRaw ?? []
  );
  const marketSignalsRefreshedAt =
    coreSourcesRefreshedAt ?? latestLaunchSignalAt;

  const topModelIds = selectHomepageTopModelIds(homepageActiveModels, 10, now);

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
  const topModelsWithDirectEvidenceCount = topModels.filter((model) => {
    const evidence = countMarketValueEvidence({
      benchmarkScores: model.benchmark_scores,
      eloRatings: model.elo_ratings,
      pricingEntries: model.model_pricing,
    });

    return evidence.benchmarkCount > 0 || evidence.arenaFamilyCount > 0;
  }).length;

  const newModels = buildHomepageLaunchSelections(
    ((allActiveModels ?? []) as unknown as Parameters<
      typeof buildHomepageLaunchSelections
    >[0]),
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
    ((allActiveModels ?? []) as unknown as Parameters<
      typeof buildHomepageDeploymentSelections
    >[0]),
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
        marketSignalsRelative={
          marketSignalsRefreshedAt
            ? formatRelativeTimeAt(marketSignalsRefreshedAt, now)
            : null
        }
        marketSignalsAbsolute={
          marketSignalsRefreshedAt ? formatDate(marketSignalsRefreshedAt) : null
        }
        marketSignalsDetail={
          coreSourcesRefreshedAt ? "model and launch sources" : "market updates"
        }
      />

      {/* Top 10 Leaderboard */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-neon" />
              <h2 className="text-xl font-bold">Top AI Models</h2>
            </div>
            <HomepageMoverStrip />
          </div>
          <Button variant="ghost" size="sm" className="text-neon" asChild>
            <Link href="/leaderboards">
              View All <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          Start here for the models with the strongest current mix of quality, reach, pricing,
          and verified market signals.
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
                  <div className="flex items-center justify-end gap-1">
                    <span>Est. Market Value</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center text-muted-foreground transition-colors hover:text-foreground"
                          aria-label="Top model ranking methodology"
                        >
                          <CircleHelp className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs leading-5">
                        Ranked for economic footprint, adoption, and quality, with extra trust
                        given to direct benchmark, arena, and verified pricing evidence.{" "}
                        {topModelsWithDirectEvidenceCount} of {topModels.length || 0} shortlisted
                        models currently show direct benchmark or arena evidence.
                      </TooltipContent>
                    </Tooltip>
                  </div>
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
                const hasDirectBenchmarkEvidence =
                  evidence.benchmarkCount > 0 || evidence.arenaFamilyCount > 0;
                const deploymentLabel = getDeployabilityLabel({
                  isOpenWeights: model.is_open_weights,
                  accessOffer: getBestAccessOfferForModel(accessOffers, model.id),
                });
                const upgradeHighlight = getModelUpgradeHighlight(model);

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
                            {upgradeHighlight ? (
                              <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
                                {upgradeHighlight}
                              </p>
                            ) : null}
                            <div className="mt-1 flex flex-wrap gap-1">
                              {deploymentLabel ? (
                                <Badge
                                  variant="outline"
                                  className="border-cyan-500/30 bg-cyan-500/10 text-[10px] text-cyan-200"
                                >
                                  {deploymentLabel}
                                </Badge>
                              ) : null}
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  hasDirectBenchmarkEvidence
                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                                    : "border-amber-500/30 bg-amber-500/10 text-amber-200"
                                }`}
                              >
                                {hasDirectBenchmarkEvidence ? "Benchmark-backed" : "Signal-backed"}
                              </Badge>
                            </div>
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

      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Rocket className="h-5 w-5 text-neon" />
            <h2 className="text-xl font-bold">New in the market</h2>
          </div>
          <Button variant="ghost" size="sm" className="text-neon" asChild>
            <Link href="/news">
              View All <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          Track new launches and newly verified ways to run or buy access to important models,
          without burning half the page on two lookalike card walls.
        </p>

        <Tabs defaultValue="launches" className="mt-6">
          <TabsList variant="line" className="w-full rounded-xl border border-border/50 bg-card/35 p-1 sm:w-fit">
            <TabsTrigger value="launches">Launches</TabsTrigger>
            {newDeploymentPaths.length > 0 ? (
              <TabsTrigger value="deployments">Deployments</TabsTrigger>
            ) : null}
          </TabsList>

          <TabsContent value="launches" className="mt-5">
            <div className="overflow-x-auto pb-2">
              <div className="flex min-w-full gap-4">
                {newModels?.map(({ model, surfacedAt }) => {
                  const catConfig = CATEGORIES.find((c) => c.slug === model.category);
                  const parameterDisplay = getParameterDisplay(model);
                  const surfaceDateValue = surfacedAt ?? model.release_date ?? null;
                  const dateLabel = getRelativeDateLabel(surfaceDateValue, now);
                  const deploymentLabel = getDeployabilityLabel({
                    isOpenWeights: model.is_open_weights,
                    accessOffer: getBestAccessOfferForModel(accessOffers, model.id),
                  });
                  const upgradeHighlight = getModelUpgradeHighlight(model);

                  return (
                    <Link
                      key={model.id}
                      href={`/models/${model.slug}`}
                      className="min-w-[280px] flex-1 snap-start sm:min-w-[320px]"
                    >
                      <Card className="group h-full border-border/50 bg-card transition-all hover:border-neon/30 hover:glow-neon">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <Badge
                              variant="outline"
                              className="border-gain/30 bg-gain/10 text-[11px] text-gain"
                            >
                              NEW
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">{dateLabel}</span>
                          </div>
                          <h3 className="mt-3 text-sm font-semibold transition-colors group-hover:text-neon">
                            {model.name}
                          </h3>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <ProviderLogo provider={model.provider} size="sm" />
                            <p className="text-xs text-muted-foreground">{model.provider}</p>
                          </div>
                          {upgradeHighlight ? (
                            <p className="mt-2 line-clamp-3 text-[11px] leading-5 text-muted-foreground">
                              {upgradeHighlight}
                            </p>
                          ) : null}
                          <div className="mt-3 flex items-center justify-between gap-3">
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
            </div>
          </TabsContent>

          {newDeploymentPaths.length > 0 ? (
            <TabsContent value="deployments" className="mt-5">
              <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Server className="h-4 w-4 text-neon" />
                <span>
                  New official APIs, self-host paths, and verified platform rollouts for tracked models.
                </span>
              </div>
              <div className="overflow-x-auto pb-2">
                <div className="flex min-w-full gap-4">
                  {newDeploymentPaths.map(
                    ({ model, surfacedAt, title, summary, source, signalType }) => {
                      const catConfig = CATEGORIES.find((c) => c.slug === model.category);
                      const parameterDisplay = getParameterDisplay(model);
                      const dateLabel = getRelativeDateLabel(surfacedAt, now);

                      return (
                        <Link
                          key={`${model.id}-${source ?? "deployment"}`}
                          href={`/models/${model.slug}`}
                          className="min-w-[280px] flex-1 snap-start sm:min-w-[320px]"
                        >
                          <Card className="group h-full border-border/50 bg-card transition-all hover:border-neon/30 hover:glow-neon">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between gap-2">
                                <Badge
                                  variant="outline"
                                  className="border-neon/30 bg-neon/10 text-[11px] text-neon"
                                >
                                  {getUsageUpdateBadgeLabel(signalType)}
                                </Badge>
                                <span className="text-[11px] text-muted-foreground">
                                  {dateLabel}
                                </span>
                              </div>
                              <h3 className="mt-3 text-sm font-semibold transition-colors group-hover:text-neon">
                                {model.name}
                              </h3>
                              <div className="mt-0.5 flex items-center gap-1.5">
                                <ProviderLogo provider={model.provider} size="sm" />
                                <p className="text-xs text-muted-foreground">{model.provider}</p>
                              </div>
                              <p className="mt-3 line-clamp-2 text-sm text-foreground/90">
                                {title}
                              </p>
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
                    }
                  )}
                </div>
              </div>
            </TabsContent>
          ) : null}
        </Tabs>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shuffle className="h-5 w-5 text-neon" />
            <h2 className="text-xl font-bold">What&apos;s moving now</h2>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          The market-cap view needs movement, not two equal-weight widgets fighting for attention.
        </p>
        <Tabs defaultValue="movers" className="mt-6">
          <TabsList variant="line" className="w-full rounded-xl border border-border/50 bg-card/35 p-1 sm:w-fit">
            <TabsTrigger value="movers">Top Movers</TabsTrigger>
            <TabsTrigger value="trending">Trending</TabsTrigger>
          </TabsList>

          <TabsContent value="movers" className="mt-5">
            <TopMovers />
          </TabsContent>

          <TabsContent value="trending" className="mt-5">
            <Card className="border-border/50 bg-card">
              <CardContent className="p-4">
                <div className="mb-4 flex items-center gap-3">
                  <Flame className="h-5 w-5 text-neon" />
                  <h3 className="text-lg font-semibold">Trending Models</h3>
                </div>
                <TrendingModels limit={8} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-neon" />
          <h2 className="text-xl font-bold">Go deeper when you need it</h2>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          The homepage should shortlist decisions. Frontier charts, supply maps, and subscription
          breakdowns belong one click deeper.
        </p>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <Link href="/leaderboards?tab=frontier">
            <Card className="group h-full border-border/50 bg-card transition-all hover:border-neon/30 hover:glow-neon">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="h-4 w-4 text-neon" />
                  Quality vs Price Frontier
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  See the full efficiency scatter plot when you are comparing outcome quality to verified spend.
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/leaderboards">
            <Card className="group h-full border-border/50 bg-card transition-all hover:border-neon/30 hover:glow-neon">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Scale className="h-4 w-4 text-neon" />
                  Market Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Explore deeper market structure through ranking views, provider concentration, and category slices.
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/pricing">
            <Card className="group h-full border-border/50 bg-card transition-all hover:border-neon/30 hover:glow-neon">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Server className="h-4 w-4 text-neon" />
                  Best Subscription Access
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Compare paid plans and verified access routes on the dedicated pricing surface instead of in the hero flow.
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>

      {/* CTA Section */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <Card className="relative overflow-hidden border-neon/20 bg-gradient-to-r from-neon/5 via-neon/10 to-neon/5">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-neon/5 to-transparent" />
          <CardContent className="relative flex flex-col items-center p-8 text-center md:p-12">
            <h2 className="text-2xl font-bold md:text-3xl">
              Get the API or start tracking the market directly
            </h2>
            <p className="mt-3 max-w-lg text-muted-foreground">
              Pull rankings and model metadata into your own workflows, or start with
              watchlists and live surfaces before you build anything custom.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                className="bg-neon text-background font-semibold hover:bg-neon/90"
                asChild
              >
                <Link href="/api-docs">
                  Get the API
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/discover" prefetch={false}>
                  Start Tracking
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
