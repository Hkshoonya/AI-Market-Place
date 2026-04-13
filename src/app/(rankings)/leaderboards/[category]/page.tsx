import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  CATEGORIES,
  CATEGORY_MAP,
  type ModelCategory,
} from "@/lib/constants/categories";
import { createPublicClient } from "@/lib/supabase/public-server";
import { parseQueryResult } from "@/lib/schemas/parse";
import { CategoryModelSchema } from "@/lib/schemas/rankings";
import { getParameterDisplay } from "@/lib/models/presentation";
import { pickBestModelSignals } from "@/lib/news/model-signals";
import {
  buildAccessOffersCatalog,
  getBestAccessOfferForModel,
} from "@/lib/models/access-offers";
import {
  getDeployabilityLabel,
  isSelfHostedDeployabilityLabel,
} from "@/lib/models/deployability";
import { ProviderLogo } from "@/components/shared/provider-logo";
import { BenchmarkTrackingBadge } from "@/components/models/benchmark-tracking-badge";
import type { Metadata } from "next";
import type { z } from "zod";
import { getLifecycleBadge, getLifecycleStatuses, parseLifecycleFilter } from "@/lib/models/lifecycle";
import { getPublicLensLabel, parsePublicRankingLens, type PublicRankingLens } from "@/lib/models/public-lenses";
import { getPublicPricingSummary } from "@/lib/models/pricing";
import { buildBenchmarkTrackingSummaryMap } from "@/lib/models/benchmark-tracking-bulk";
import { dedupePublicModelFamilies } from "@/lib/models/public-families";
import { preferDefaultPublicSurfaceReady } from "@/lib/models/public-surface-readiness";
import { selectPublicRankingPool } from "@/lib/models/public-ranking-confidence";
import { SITE_URL } from "@/lib/constants/site";

export const revalidate = 3600;

export async function generateStaticParams() {
  return CATEGORIES.map((category) => ({ category: category.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const categoryConfig = CATEGORY_MAP[category as ModelCategory];
  if (!categoryConfig) return { title: "Category Not Found" };

  return {
    title: `${categoryConfig.label} Leaderboard`,
    description: `Rankings of the best ${categoryConfig.label.toLowerCase()} AI models by capability, speed, and value.`,
    openGraph: {
      title: `${categoryConfig.label} Leaderboard`,
      description: `Rankings of the best ${categoryConfig.label.toLowerCase()} AI models by capability, speed, and value.`,
      url: `${SITE_URL}/leaderboards/${category}`,
    },
    alternates: {
      canonical: `${SITE_URL}/leaderboards/${category}`,
    },
  };
}

export default async function CategoryLeaderboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ lens?: string; lifecycle?: string }>;
}) {
  const { category } = await params;
  const query = await searchParams;
  const categoryConfig = CATEGORY_MAP[category as ModelCategory];

  if (!categoryConfig) {
    notFound();
  }

  const supabase = createPublicClient();
  const activeLens = parsePublicRankingLens(query.lens);
  const lifecycleFilter = parseLifecycleFilter(query.lifecycle);
  const lifecycleStatuses = getLifecycleStatuses(lifecycleFilter);

  let modelsQuery = supabase
    .from("models")
    .select("*, benchmark_scores(*, benchmarks(*)), model_pricing(*), rankings(*)")
    .eq("category", category as import("@/types/database").ModelCategory)
    .order(activeLens === "value" ? "value_score" : `${activeLens === "economic" ? "economic_footprint" : activeLens}_score`, {
      ascending: activeLens === "value" ? false : false,
      nullsFirst: false,
    });

  modelsQuery =
    lifecycleFilter === "all"
      ? modelsQuery.in("status", lifecycleStatuses)
      : modelsQuery.eq("status", "active");

  const modelsResponse = await modelsQuery;

  type CategoryModel = z.infer<typeof CategoryModelSchema>;
  const models = selectPublicRankingPool(
    preferDefaultPublicSurfaceReady(
      dedupePublicModelFamilies(
        parseQueryResult(
          modelsResponse,
          CategoryModelSchema,
          "CategoryModel"
        )
      ),
      10
    ),
    10
  );

  const isBrowserCategory = category === "agentic_browser";
  const primaryMetricLabel = isBrowserCategory && activeLens === "capability"
    ? "Browser Score"
    : getPublicLensLabel(activeLens);

  const sortedModels = [...models].sort((left, right) => {
    const leftPrimary =
      getPrimaryMetric(left, activeLens, isBrowserCategory) ?? left.quality_score ?? Number.NEGATIVE_INFINITY;
    const rightPrimary =
      getPrimaryMetric(right, activeLens, isBrowserCategory) ?? right.quality_score ?? Number.NEGATIVE_INFINITY;

    if (rightPrimary !== leftPrimary) return rightPrimary - leftPrimary;

    const leftSecondary =
      left.quality_score ?? left.capability_score ?? Number.NEGATIVE_INFINITY;
    const rightSecondary =
      right.quality_score ?? right.capability_score ?? Number.NEGATIVE_INFINITY;

    if (rightSecondary !== leftSecondary) return rightSecondary - leftSecondary;

    return (
      (left.category_rank ?? left.overall_rank ?? Number.MAX_SAFE_INTEGER) -
      (right.category_rank ?? right.overall_rank ?? Number.MAX_SAFE_INTEGER)
    );
  });

  const benchmarkMap = new Map<string, { name: string; slug: string }>();
  for (const model of sortedModels) {
    for (const benchmarkScore of model.benchmark_scores ?? []) {
      const benchmark = benchmarkScore.benchmarks;
      if (benchmark && !benchmarkMap.has(benchmark.slug)) {
        benchmarkMap.set(benchmark.slug, {
          name: benchmark.name,
          slug: benchmark.slug,
        });
      }
    }
  }
  const benchmarks = Array.from(benchmarkMap.values());
  const leaderboardModelIds = sortedModels.map((model) => model.id);

  const [{ data: newsRaw }, { data: deploymentPlatformsRaw }, { data: modelDeploymentsRaw }] =
    leaderboardModelIds.length > 0
      ? await Promise.all([
          supabase
            .from("model_news")
            .select("id, title, source, related_provider, related_model_ids, published_at, metadata")
            .order("published_at", { ascending: false })
            .limit(200),
          supabase.from("deployment_platforms").select("*").order("name"),
          supabase
            .from("model_deployments")
            .select(
              "id, model_id, platform_id, pricing_model, price_per_unit, unit_description, free_tier, one_click, status"
            )
            .in("model_id", leaderboardModelIds)
            .eq("status", "available"),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];

  const recentNewsItems = (newsRaw ?? []).map((item) => ({
    id: typeof item.id === "string" ? item.id : null,
    title: typeof item.title === "string" ? item.title : null,
    source: typeof item.source === "string" ? item.source : null,
    related_provider:
      typeof item.related_provider === "string" ? item.related_provider : null,
    related_model_ids: Array.isArray(item.related_model_ids)
      ? item.related_model_ids.filter((value): value is string => typeof value === "string")
      : null,
    published_at:
      typeof item.published_at === "string" ? item.published_at : null,
    metadata:
      item.metadata && typeof item.metadata === "object"
        ? (item.metadata as Record<string, unknown>)
        : null,
  }));
  const modelSignals = pickBestModelSignals(sortedModels, recentNewsItems);

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

  const accessCatalog = buildAccessOffersCatalog({
    platforms: deploymentPlatforms,
    deployments: (modelDeploymentsRaw ?? []) as Array<{
      id: string;
      model_id: string;
      platform_id: string;
      pricing_model: string | null;
      price_per_unit: number | null;
      unit_description: string | null;
      free_tier: string | null;
      one_click: boolean;
      status?: string | null;
    }>,
    models: sortedModels.map((model) => ({
      id: model.id,
      slug: model.slug,
      name: model.name,
      provider: model.provider,
      category: model.category,
      quality_score: model.quality_score,
      capability_score: model.capability_score,
      adoption_score: model.adoption_score,
      economic_footprint_score: model.economic_footprint_score,
    })),
  });
  const benchmarkTrackingClient =
    supabase as unknown as Parameters<typeof buildBenchmarkTrackingSummaryMap>[0];
  const benchmarkTrackingByModelId = await buildBenchmarkTrackingSummaryMap(
    benchmarkTrackingClient,
    sortedModels.map((model) => ({
      id: model.id,
      slug: model.slug,
      provider: model.provider,
      category: model.category,
    }))
  );

  const deploymentLabelsByModelId = new Map(
    sortedModels.map((model) => [
      model.id,
      getDeployabilityLabel({
        isOpenWeights: model.is_open_weights,
        signal: modelSignals.get(model.id) ?? null,
        accessOffer: getBestAccessOfferForModel(accessCatalog, model.id),
      }),
    ])
  );
  const deployableModelsCount = sortedModels.filter((model) =>
    Boolean(deploymentLabelsByModelId.get(model.id))
  ).length;
  const selfHostModelsCount = sortedModels.filter((model) => {
    const label = deploymentLabelsByModelId.get(model.id);
    return isSelfHostedDeployabilityLabel(label);
  }).length;

  function getBenchmarkScore(
    model: CategoryModel,
    benchmarkSlug: string
  ): number | null {
    const scores = model.benchmark_scores ?? [];
    const match = scores.find((score) => score.benchmarks?.slug === benchmarkSlug);
    return match ? Number(match.score_normalized) : null;
  }

  function getBestSpeed(model: CategoryModel): number | null {
    const pricing = model.model_pricing ?? [];
    const speeds = pricing
      .map((entry) => Number(entry.median_output_tokens_per_second))
      .filter((speed) => !Number.isNaN(speed) && speed > 0);
    return speeds.length > 0 ? Math.max(...speeds) : null;
  }

  function getPrimaryMetric(
    model: CategoryModel,
    lens: PublicRankingLens,
    browserCategory: boolean
  ): number | null {
    switch (lens) {
      case "capability":
        return browserCategory
          ? (model.agent_score != null ? Number(model.agent_score) : null)
          : (model.capability_score != null ? Number(model.capability_score) : null);
      case "popularity":
        return model.popularity_score != null ? Number(model.popularity_score) : null;
      case "adoption":
        return model.adoption_score != null ? Number(model.adoption_score) : null;
      case "value":
        return model.value_score != null ? Number(model.value_score) : null;
      case "economic":
      default:
        return model.economic_footprint_score != null
          ? Number(model.economic_footprint_score)
          : null;
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Link
        href="/leaderboards"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All Leaderboards
      </Link>

      <div className="flex items-center gap-4">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${categoryConfig.color}15` }}
        >
          <categoryConfig.icon
            className="h-6 w-6"
            style={{ color: categoryConfig.color }}
          />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{categoryConfig.label} Leaderboard</h1>
          <p className="text-muted-foreground">{categoryConfig.description}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["capability", "popularity", "adoption", "economic", "value"] as const).map((lens) => (
          <Link
            key={lens}
            href={`/leaderboards/${category}?lens=${lens}${lifecycleFilter === "all" ? "&lifecycle=all" : ""}`}
          >
            <Badge
              variant="outline"
              className={
                activeLens === lens
                  ? "cursor-pointer border-neon/30 bg-neon/10 text-neon"
                  : "cursor-pointer border-border/50 text-muted-foreground"
              }
            >
              {getPublicLensLabel(lens)}
            </Badge>
          </Link>
        ))}
        <Link href={`/leaderboards/${category}?lens=${activeLens}`}>
          <Badge
            variant="outline"
            className={
              lifecycleFilter === "active"
                ? "cursor-pointer border-neon/30 bg-neon/10 text-neon"
                : "cursor-pointer border-border/50 text-muted-foreground"
            }
          >
            Active Only
          </Badge>
        </Link>
        <Link href={`/leaderboards/${category}?lens=${activeLens}&lifecycle=all`}>
          <Badge
            variant="outline"
            className={
              lifecycleFilter === "all"
                ? "cursor-pointer border-neon/30 bg-neon/10 text-neon"
                : "cursor-pointer border-border/50 text-muted-foreground"
            }
          >
            Include Non-Active
          </Badge>
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{sortedModels.length}</p>
            <p className="text-xs text-muted-foreground">Models</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{benchmarks.length}</p>
            <p className="text-xs text-muted-foreground">Benchmarks</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">
              {new Set(sortedModels.map((model) => model.provider)).size}
            </p>
            <p className="text-xs text-muted-foreground">Providers</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">
              {sortedModels.filter((model) => model.is_open_weights).length}
            </p>
            <p className="text-xs text-muted-foreground">Open Weight</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{deployableModelsCount}</p>
            <p className="text-xs text-muted-foreground">Deployable Now</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
              {selfHostModelsCount} self-host
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 rounded-2xl border border-border/50 bg-card/50 p-4 text-xs text-muted-foreground">
        This leaderboard still shows tracked models beyond the ones with full benchmark rows. Use the benchmark badge on each row to tell whether the model is Structured, Provider-reported, Arena only, or still Pending benchmark coverage.
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {CATEGORIES.map((categoryTab) => (
          <Link key={categoryTab.slug} href={`/leaderboards/${categoryTab.slug}?lens=${activeLens}${lifecycleFilter === "all" ? "&lifecycle=all" : ""}`}>
            <Badge
              variant="outline"
              className={`gap-1.5 px-3 py-1.5 text-xs transition-colors ${
                categoryTab.slug === category
                  ? "border-transparent font-bold"
                  : "border-border/50 text-muted-foreground hover:bg-secondary"
              }`}
              style={
                categoryTab.slug === category
                  ? {
                      backgroundColor: `${categoryTab.color}20`,
                      color: categoryTab.color,
                    }
                  : undefined
              }
            >
              <categoryTab.icon className="h-3.5 w-3.5" />
              {categoryTab.shortLabel}
            </Badge>
          </Link>
        ))}
      </div>

      {sortedModels.length > 0 ? (
        <Card className="mt-8 overflow-hidden border-border/50">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50 bg-secondary/20">
                    <th className="w-12 px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      Model
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                      {primaryMetricLabel}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                      Quality
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                      Params
                    </th>
                    {benchmarks.slice(0, 4).map((benchmark) => (
                      <th
                        key={benchmark.slug}
                        className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground lg:table-cell"
                      >
                        {benchmark.name}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                      $/M In
                    </th>
                    <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground sm:table-cell">
                      Speed
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                      Open
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedModels.map((model, index) => {
                    const pricingSummary = getPublicPricingSummary({
                      id: model.id,
                      slug: model.slug,
                      name: model.name,
                      provider: model.provider,
                      overall_rank: model.overall_rank,
                      is_open_weights: model.is_open_weights,
                      model_pricing: model.model_pricing,
                    });
                    const speed = getBestSpeed(model);
                    const parameterDisplay = getParameterDisplay(model);
                    const primaryMetric = getPrimaryMetric(model, activeLens, isBrowserCategory) ?? model.quality_score;
                    const lifecycleBadge = getLifecycleBadge(model.status);
                    const deployabilityLabel = deploymentLabelsByModelId.get(model.id);

                    return (
                      <tr
                        key={model.id}
                        className="border-b border-border/30 transition-colors hover:bg-secondary/20"
                      >
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-1">
                            {index < 3 && (
                              <Trophy
                                className="h-3.5 w-3.5"
                                style={{ color: categoryConfig.color }}
                              />
                            )}
                            <span
                              className={`font-bold ${
                                index < 3 ? "" : "text-muted-foreground"
                              }`}
                              style={
                                index < 3 ? { color: categoryConfig.color } : undefined
                              }
                            >
                              {model.category_rank ?? index + 1}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/models/${model.slug}`}
                            className="transition-colors hover:text-neon"
                          >
                            <div className="flex items-center gap-2">
                              <ProviderLogo provider={model.provider} size="sm" />
                              <div>
                                <p className="text-sm font-semibold">{model.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {model.provider}
                                </p>
                                {deployabilityLabel && (
                                  <Badge
                                    variant="outline"
                                    className="mt-1 mr-1 border-cyan-500/30 bg-cyan-500/10 text-[10px] text-cyan-200"
                                  >
                                    {deployabilityLabel}
                                  </Badge>
                                )}
                                <BenchmarkTrackingBadge
                                  summary={benchmarkTrackingByModelId.get(model.id)}
                                  className="mt-1 mr-1"
                                />
                                {lifecycleBadge && !lifecycleBadge.rankedByDefault && (
                                  <Badge variant="outline" className="mt-1 text-[10px]">
                                    {lifecycleBadge.label}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-bold tabular-nums text-neon">
                            {primaryMetric != null ? Number(primaryMetric).toFixed(1) : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm tabular-nums text-muted-foreground">
                            {model.quality_score != null
                              ? Number(model.quality_score).toFixed(1)
                              : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-muted-foreground tabular-nums">
                          {parameterDisplay.label}
                        </td>
                        {benchmarks.slice(0, 4).map((benchmark) => {
                          const score = getBenchmarkScore(model, benchmark.slug);
                          return (
                            <td
                              key={benchmark.slug}
                              className="hidden px-4 py-3 text-right text-sm tabular-nums lg:table-cell"
                            >
                              {score !== null ? score.toFixed(1) : "—"}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-right text-sm tabular-nums">
                          {pricingSummary.compactDisplay ? (
                            <div className="space-y-0.5">
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
                        </td>
                        <td className="hidden px-4 py-3 text-right text-sm tabular-nums text-muted-foreground sm:table-cell">
                          {speed !== null ? `${speed.toFixed(0)} tok/s` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {model.is_open_weights ? (
                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-gain" />
                          ) : (
                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-16 text-center">
          <p className="text-muted-foreground">
            No models found in this category yet.
          </p>
        </div>
      )}
    </div>
  );
}
