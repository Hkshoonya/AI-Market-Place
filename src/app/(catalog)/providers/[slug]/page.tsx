import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Download,
  ExternalLink,
  Heart,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CATEGORIES } from "@/lib/constants/categories";
import { createPublicClient } from "@/lib/supabase/public-server";
import { z } from "zod";
import { parseQueryResultPartial } from "@/lib/schemas/parse";
import { ModelBaseSchema } from "@/lib/schemas/models";
import { formatNumber, formatTokenPrice } from "@/lib/format";
import { ProviderLogo } from "@/components/shared/provider-logo";
import {
  getProviderBrand,
  providerMatchesCanonical,
  resolveProviderSlug,
} from "@/lib/constants/providers";
import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/constants/site";
import { getPublicPricingSummary } from "@/lib/models/pricing";
import { formatMarketValue } from "@/lib/models/market-value";
import { dedupePublicModelFamilies } from "@/lib/models/public-families";
import { getParameterDisplay } from "@/lib/models/presentation";
import {
  buildAccessOffersCatalog,
  getBestAccessOfferForModel,
} from "@/lib/models/access-offers";
import { buildLaunchRadar, summarizeNewsSignals } from "@/lib/news/presentation";
import { filterProviderSignals } from "@/lib/news/provider-signals";
import { SignalSummary } from "@/components/news/signal-summary";
import { LaunchRadar } from "@/components/news/launch-radar";
import { ProviderSignalBadge } from "@/components/news/provider-signal-badge";
import { DataFreshnessBadge } from "@/components/shared/data-freshness-badge";
import { averageCapabilityMetric, getCapabilityMetricValue } from "@/lib/providers/metrics";
import { getNewsSignalType } from "@/lib/news/presentation";
import { summarizeProviderSelfHostRequirements } from "@/lib/models/self-host-requirements";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createPublicClient();
  const { data } = await supabase.from("models").select("provider").eq("status", "active");
  const allProviders = [...new Set((data ?? []).map((m) => m.provider))];
  const providerName = resolveProviderSlug(slug, allProviders);

  if (!providerName) return { title: "Provider Not Found" };

  const title = `${providerName} AI Models`;
  const description = `Explore all AI models by ${providerName}. Official pricing posture, rankings, benchmark coverage, and market-value signals on ${SITE_NAME}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/providers/${slug}`,
    },
    alternates: {
      canonical: `${SITE_URL}/providers/${slug}`,
    },
  };
}

export default async function ProviderDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createPublicClient();

  const { data: providerRows } = await supabase
    .from("models")
    .select("provider")
    .eq("status", "active");
  const allProviders = [...new Set((providerRows ?? []).map((m) => m.provider))];
  const providerName = resolveProviderSlug(slug, allProviders);

  if (!providerName) notFound();

  const ProviderModelSchema = ModelBaseSchema.extend({
    model_pricing: z
      .array(
        z.object({
          provider_name: z.string().nullable().optional(),
          input_price_per_million: z.number().nullable(),
          output_price_per_million: z.number().nullable().optional(),
          source: z.string().nullable().optional(),
          currency: z.string().nullable().optional(),
        })
      )
      .optional(),
  });

  const modelsResponse = await supabase
    .from("models")
    .select("*, model_pricing(*)")
    .eq("status", "active")
    .order("overall_rank", { ascending: true, nullsFirst: false });

  const models = dedupePublicModelFamilies(
    parseQueryResultPartial(modelsResponse, ProviderModelSchema, "ProviderModel").filter(
      (model) => providerMatchesCanonical(model.provider, providerName)
    )
  );
  if (models.length === 0) notFound();

  const providerModelIds = models.map((model) => model.id);
  const [deploymentsResponse, platformsResponse] =
    providerModelIds.length > 0
      ? await Promise.all([
          supabase
            .from("model_deployments")
            .select("id, model_id, platform_id, pricing_model, price_per_unit, unit_description, free_tier, one_click, status")
            .in("model_id", providerModelIds)
            .eq("status", "available"),
          supabase.from("deployment_platforms").select("*").order("name"),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];
  const providerNewsResponse = await supabase
    .from("model_news")
    .select(
      "id, title, summary, url, source, category, related_provider, related_model_ids, published_at, metadata"
    )
    .not("related_provider", "is", null)
    .order("published_at", { ascending: false })
    .limit(120);

  const deploymentPlatforms = (platformsResponse.data ?? []).map((platform) => {
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

  const providerAccessCatalog = buildAccessOffersCatalog({
    platforms: deploymentPlatforms,
    deployments: deploymentsResponse.data ?? [],
    models,
  });
  const providerAccessOffers = providerAccessCatalog.subscriptionOffers;
  const deploymentPlatformById = new Map(
    deploymentPlatforms.map((platform) => [platform.id, platform])
  );

  const brand = getProviderBrand(providerName);
  const providerNews = filterProviderSignals(
    providerName,
    (providerNewsResponse.data ?? []).map((item) => ({
      id: typeof item.id === "string" ? item.id : null,
      title: typeof item.title === "string" ? item.title : null,
      summary: typeof item.summary === "string" ? item.summary : null,
      url: typeof item.url === "string" ? item.url : null,
      source: typeof item.source === "string" ? item.source : null,
      category: typeof item.category === "string" ? item.category : null,
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
    }))
  );
  const providerSignalSummary = summarizeNewsSignals(providerNews);
  const providerRadar = buildLaunchRadar(providerNews, 6);
  const providerDeploymentNews = providerNews.filter((item) => {
    const signalType = getNewsSignalType(item);
    return signalType === "api" || signalType === "open_source";
  });
  const providerDeploymentRadar = buildLaunchRadar(providerDeploymentNews, 4);
  const latestSignalAt = providerRadar[0]?.published_at ?? null;
  const totalDownloads = models.reduce((sum, model) => sum + (model.hf_downloads ?? 0), 0);
  const totalLikes = models.reduce((sum, model) => sum + (model.hf_likes ?? 0), 0);
  const avgCapability = averageCapabilityMetric(models);
  const topRank = models.find((model) => model.overall_rank != null)?.overall_rank;
  const openCount = models.filter((model) => model.is_open_weights).length;
  const topValueModel = [...models].sort(
    (left, right) =>
      Number(right.market_cap_estimate ?? 0) - Number(left.market_cap_estimate ?? 0)
  )[0];
  const officialPricedModels = models.filter(
    (model) => getPublicPricingSummary(model).official != null
  ).length;
  const verifiedDeploymentModelIds = new Set(
    (deploymentsResponse.data ?? []).map((deployment) => deployment.model_id)
  );
  const localDeployModelIds = new Set<string>();
  const cloudServerModelIds = new Set<string>();
  const managedDeployModelIds = new Set<string>();

  for (const deployment of deploymentsResponse.data ?? []) {
    const platform = deploymentPlatformById.get(deployment.platform_id);
    if (!platform) continue;

    const isLocal = platform.slug === "ollama" || platform.type === "local";
    const isCloudServer =
      platform.slug === "runpod" ||
      platform.slug === "vast-ai" ||
      platform.slug === "lambda-cloud" ||
      platform.slug === "modal" ||
      platform.slug === "gcp-vertex" ||
      platform.type === "self-hosted";
    if (isLocal) {
      localDeployModelIds.add(deployment.model_id);
    } else if (isCloudServer) {
      cloudServerModelIds.add(deployment.model_id);
    } else {
      managedDeployModelIds.add(deployment.model_id);
    }
  }

  const verifiedPriceFloor =
    [...models]
      .map((model) => getPublicPricingSummary(model).compactPrice)
      .filter((price): price is number => price != null)
      .sort((left, right) => left - right)[0] ?? null;

  const categoryBreakdown = new Map<string, number>();
  for (const model of models) {
    categoryBreakdown.set(model.category, (categoryBreakdown.get(model.category) ?? 0) + 1);
  }
  const dominantCategory = [...categoryBreakdown.entries()].sort((a, b) => b[1] - a[1])[0];
  const dominantCategoryConfig = dominantCategory
    ? CATEGORIES.find((category) => category.slug === dominantCategory[0])
    : null;
  const providerSelfHostSummary = summarizeProviderSelfHostRequirements(
    models.map((model) => ({
      isOpenWeights: model.is_open_weights,
      parameterCount: model.parameter_count,
      contextWindow: model.context_window,
      modalities: Array.isArray(model.modalities) ? (model.modalities as string[]) : [],
      category: model.category,
    }))
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Link
        href="/providers"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All Providers
      </Link>

      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <ProviderLogo provider={providerName} size="lg" />
          <div>
            <h1 className="text-3xl font-bold">{providerName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Plain-language provider view: what this company is strongest at, how many active models it has,
              what pricing we can verify, and which current models matter most.
            </p>
            <div className="mt-3">
              <DataFreshnessBadge
                label="Provider stream refreshed"
                timestamp={latestSignalAt}
                detail="detail view"
              />
            </div>
            {providerRadar[0] ? (
              <div className="mt-3">
                <ProviderSignalBadge
                  signal={{
                    title: providerRadar[0].title ?? "Recent provider update",
                    signalType: providerRadar[0].signalType,
                    signalLabel: providerRadar[0].signalLabel,
                    signalImportance: providerRadar[0].signalImportance,
                    publishedAt: providerRadar[0].published_at ?? null,
                    source: providerRadar[0].source ?? null,
                    relatedProvider: providerRadar[0].related_provider ?? null,
                  }}
                />
              </div>
            ) : null}
            {brand && (
              <a
                href={`https://${brand.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-neon transition-colors"
              >
                {brand.domain}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/models?provider=${encodeURIComponent(providerName)}`}>View All Models</Link>
          </Button>
          {brand && (
            <Button variant="outline" size="sm" asChild>
              <a href={`https://${brand.domain}`} target="_blank" rel="noopener noreferrer">
                Visit Website
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        {[
          { label: "Models", value: models.length.toString(), icon: BarChart3 },
          { label: "Top Rank", value: topRank ? `#${topRank}` : "—", icon: BarChart3 },
          {
            label: "Avg Capability",
            value: avgCapability != null ? avgCapability.toFixed(1) : "—",
            icon: Zap,
          },
          { label: "Downloads", value: formatNumber(totalDownloads), icon: Download },
          { label: "Likes", value: formatNumber(totalLikes), icon: Heart },
          { label: "Open Models", value: openCount.toString(), icon: Zap },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/50 bg-card">
            <CardContent className="p-3 text-center">
              <stat.icon className="mx-auto mb-1 h-4 w-4 text-neon" />
              <p className="text-lg font-bold">{stat.value}</p>
              <p className="text-[11px] text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-8 border-border/50 bg-card">
        <CardHeader>
          <CardTitle className="text-lg">Provider Footprint</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Pricing Posture
            </p>
            <p className="mt-2 text-sm font-semibold">
              {officialPricedModels} / {models.length} models have official company pricing
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              This tells you how often we can verify direct first-party pricing instead of only broker or router pricing.
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Lowest Verified Entry
            </p>
            <p className="mt-2 text-sm font-semibold">
              {verifiedPriceFloor != null ? `${formatTokenPrice(verifiedPriceFloor)}/M` : "Unavailable"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              The lowest reliable public price we could verify across this provider&apos;s active lineup.
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Strategic Strength
            </p>
            <p className="mt-2 text-sm font-semibold">
              {dominantCategoryConfig?.shortLabel ?? dominantCategory?.[0] ?? "Mixed portfolio"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {topValueModel
                ? `${topValueModel.name} leads current estimated value at ${formatMarketValue(topValueModel.market_cap_estimate)}.`
                : "Estimated value data is not available yet."}
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Deployment Reach
            </p>
            <p className="mt-2 text-sm font-semibold">
              {verifiedDeploymentModelIds.size} / {models.length} models have verified deploy or runtime access
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {localDeployModelIds.size} on your computer · {cloudServerModelIds.size} cloud servers you control · {managedDeployModelIds.size} hosted for you
            </p>
          </div>
        </CardContent>
      </Card>

      {providerSelfHostSummary ? (
        <Card className="mb-8 border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-lg">Open-Weight Setup Reality</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Open weights do not always mean easy hosted access. For {providerName}, they usually
              mean you bring the hardware yourself or rent a cloud GPU when the models are larger.
            </p>
            <p className="text-sm font-semibold text-foreground">
              {providerSelfHostSummary.headline}
            </p>
            <p className="text-xs text-muted-foreground">
              {providerSelfHostSummary.detail}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {providerNews.length > 0 && (
        <div className="mb-8 space-y-4">
          <SignalSummary
            buckets={providerSignalSummary}
            emptyLabel="No structured provider signals have synced yet."
          />
          <LaunchRadar
            items={providerRadar}
            title="Recent Provider Signals"
            description="Recent launches, pricing moves, benchmark updates, API changes, and research signals linked to this provider."
            ctaHref="/news"
            ctaLabel="View all signals"
          />
        </div>
      )}

      {providerDeploymentRadar.length > 0 && (
        <div className="mb-8">
          <LaunchRadar
            items={providerDeploymentRadar}
            title="Recent Deployment Signals"
            description="Recent updates about new ways to use this provider's models, including self-host and official runtime options."
            ctaHref="/news"
            ctaLabel="View deployment updates"
          />
        </div>
      )}

      {providerAccessOffers.length > 0 && (
        <Card className="mb-8 border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-lg">Best Subscription Access</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {providerAccessOffers.slice(0, 3).map((offer) => (
              <div
                key={offer.platform.id}
                className="rounded-xl border border-border/50 bg-secondary/20 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{offer.platform.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{offer.bestFor}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {offer.label}
                  </Badge>
                </div>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">{offer.monthlyPriceLabel}</div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Value {offer.userValueScore.toFixed(0)} · Trust {offer.trustScore.toFixed(0)}
                    </div>
                    {offer.partnerDisclosure && (
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {offer.partnerDisclosure}
                      </div>
                    )}
                  </div>
                  <a
                    href={offer.actionUrl}
                    target="_blank"
                    rel={offer.partnerDisclosure ? "noopener sponsored" : "noopener noreferrer"}
                    className="inline-flex items-center gap-1 rounded-md bg-neon px-2.5 py-1.5 text-xs font-semibold text-background transition-colors hover:bg-neon/90"
                  >
                    {offer.actionLabel}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="mb-8 rounded-xl border border-border/50 bg-secondary/15 p-4 text-sm text-muted-foreground">
        Start with the summary cards above if you only want the quick answer.
        The tables below are for deeper comparison across categories, rankings, and individual models.
      </div>

      {categoryBreakdown.size > 1 && (
        <Card className="mb-8 border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-lg">Models by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Array.from(categoryBreakdown.entries())
                .sort(([, a], [, b]) => b - a)
                .map(([category, count]) => {
                  const categoryConfig = CATEGORIES.find((item) => item.slug === category);
                  return (
                    <Link
                      key={category}
                      href={`/models?provider=${encodeURIComponent(providerName!)}&category=${category}`}
                    >
                      <Badge
                        variant="outline"
                        className="gap-1.5 border-transparent text-xs hover:border-neon/30 transition-colors cursor-pointer"
                        style={{
                          backgroundColor: categoryConfig
                            ? `${categoryConfig.color}15`
                            : undefined,
                          color: categoryConfig?.color,
                        }}
                      >
                        {categoryConfig && <categoryConfig.icon className="h-3 w-3" />}
                        {categoryConfig?.shortLabel ?? category} ({count})
                      </Badge>
                    </Link>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50 bg-card">
        <CardHeader>
          <CardTitle className="text-lg">Active Model Lineup ({models.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-secondary/30">
                  <th className="w-12 px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    Model
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-medium text-muted-foreground sm:table-cell">
                    Category
                  </th>
                  <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground md:table-cell">
                    Params
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                    Capability
                  </th>
                  <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground md:table-cell">
                    Downloads
                  </th>
                  <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground lg:table-cell">
                    Cheapest Verified
                  </th>
                  <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground xl:table-cell">
                    Est. Value
                  </th>
                  <th className="w-16 px-4 py-3 text-center text-xs font-medium text-muted-foreground">
                    Open
                  </th>
                </tr>
              </thead>
              <tbody>
                {models.map((model) => {
                  const categoryConfig = CATEGORIES.find((item) => item.slug === model.category);
                  const rank = model.overall_rank ?? 0;
                  const pricingSummary = getPublicPricingSummary(model);
                  const accessOffer = getBestAccessOfferForModel(providerAccessCatalog, model.id);
                  const parameterDisplay = getParameterDisplay(model);
                  const capabilityValue = getCapabilityMetricValue(model);

                  return (
                    <tr
                      key={model.id}
                      className="border-b border-border/30 transition-colors hover:bg-secondary/20"
                    >
                      <td className="px-4 py-3.5">
                        <Link href={`/models/${model.slug}`}>
                          <span
                            className={`text-sm font-bold tabular-nums ${
                              rank <= 3 ? "text-neon" : "text-muted-foreground"
                            }`}
                          >
                            {rank || "—"}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <Link href={`/models/${model.slug}`}>
                          <span className="text-sm font-semibold hover:text-neon transition-colors">
                            {model.name}
                          </span>
                        </Link>
                      </td>
                      <td className="hidden px-4 py-3.5 sm:table-cell">
                        {categoryConfig && (
                          <Badge
                            variant="outline"
                            className="gap-1 border-transparent text-[11px]"
                            style={{
                              backgroundColor: `${categoryConfig.color}15`,
                              color: categoryConfig.color,
                            }}
                          >
                            <categoryConfig.icon className="h-3 w-3" />
                            {categoryConfig.shortLabel}
                          </Badge>
                        )}
                      </td>
                      <td className="hidden px-4 py-3.5 text-right text-sm text-muted-foreground md:table-cell">
                        <span className="flex items-center justify-end gap-1">
                          <Zap className="h-3 w-3 text-neon" />
                          {parameterDisplay.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-sm font-semibold tabular-nums">
                          {capabilityValue != null ? capabilityValue.toFixed(1) : "—"}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3.5 text-right text-sm text-muted-foreground md:table-cell">
                        {formatNumber(model.hf_downloads)}
                      </td>
                      <td className="hidden px-4 py-3.5 text-right text-sm lg:table-cell">
                        {accessOffer ? (
                          <div className="space-y-0.5 text-muted-foreground">
                            <div>{accessOffer.monthlyPriceLabel}</div>
                            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
                              {accessOffer.actionLabel}
                            </div>
                          </div>
                        ) : pricingSummary.compactDisplay ? (
                          <div className="space-y-0.5 text-muted-foreground">
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
                      <td className="hidden px-4 py-3.5 text-right text-sm text-muted-foreground xl:table-cell">
                        {formatMarketValue(model.market_cap_estimate)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {model.is_open_weights ? (
                          <span
                            className="inline-block h-2 w-2 rounded-full bg-gain"
                            title="Open Weights"
                          />
                        ) : (
                          <span
                            className="inline-block h-2 w-2 rounded-full bg-muted-foreground/30"
                            title="Proprietary"
                          />
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
    </div>
  );
}
