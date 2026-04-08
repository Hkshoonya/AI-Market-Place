import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  Download,
  Heart,
  MessageSquare,
  Newspaper,
  Trophy,
  Zap,
} from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CATEGORIES } from "@/lib/constants/categories";
import { createPublicClient } from "@/lib/supabase/public-server";
import { parseQueryResultSingle } from "@/lib/schemas/parse";
import { ModelWithDetailsSchema } from "@/lib/schemas/models";
import { formatNumber, formatContextWindow } from "@/lib/format";
import { CommentsSection } from "@/components/models/comments-section";
import { SimilarModels } from "@/components/models/similar-models";
import { DeployTab } from "@/components/models/deploy-tab";
import { ModelOverview } from "@/components/models/model-overview";
import { ModelViewTracker } from "@/components/models/model-view-tracker";
import { ModelHeader } from "./_components/model-header";
import { ModelStatsRow } from "./_components/model-stats-row";
import { BenchmarksTab } from "./_components/benchmarks-tab";
import { PricingTab } from "./_components/pricing-tab";
import { TradingTab } from "./_components/trading-tab";
import { TrendsTab } from "./_components/trends-tab";
import { NewsTab } from "./_components/news-tab";
import { DetailsTab } from "./_components/details-tab";
import { ChangelogTab } from "./_components/changelog-tab";
import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/constants/site";
import { collapseArenaRatings } from "@/lib/models/arena-family";
import { getModelDisplayDescription, getParameterDisplay } from "@/lib/models/presentation";
import { getLifecycleBadge } from "@/lib/models/lifecycle";
import { getCheapestVerifiedPricing } from "@/lib/models/pricing";
import { buildAccessOffersCatalog } from "@/lib/models/access-offers";
import { buildLaunchRadar, getNewsSignalType } from "@/lib/news/presentation";
import { getDeployStartPlan } from "@/lib/models/deploy-start";
import { resolveWorkspaceRuntimeExecution } from "@/lib/workspace/runtime-execution";
import { getSelfHostRequirements } from "@/lib/models/self-host-requirements";
import {
  countProviderReportedBenchmarkEvidence,
  getBenchmarkTrackingSummary,
} from "@/lib/models/benchmark-status";

export const revalidate = 300;

const MODEL_DETAIL_TABS = new Set([
  "benchmarks",
  "pricing",
  "deploy",
  "trading",
  "trends",
  "news",
  "details",
  "changelog",
]);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createPublicClient();
  const { data } = await supabase.from("models").select("name, provider, short_description, category").eq("slug", slug).single();
  const model = data as { name: string; provider: string; short_description: string | null; category: string } | null;
  if (!model) return { title: "Model Not Found" };
  const title = `${model.name} by ${model.provider}`;
  const description = model.short_description ??
    `Explore ${model.name} by ${model.provider} — benchmark coverage where available, pricing, and comparisons on ${SITE_NAME}.`;
  return {
    title, description,
    openGraph: { title, description, url: `${SITE_URL}/models/${slug}`, type: "article" },
    twitter: { card: "summary_large_image", title, description },
    alternates: { canonical: `${SITE_URL}/models/${slug}` },
  };
}

export default async function ModelDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedTab = resolvedSearchParams?.tab;
  const activeTab = requestedTab && MODEL_DETAIL_TABS.has(requestedTab)
    ? requestedTab
    : "benchmarks";
  const supabase = createPublicClient();

  const modelResponse = await supabase
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

  const model = parseQueryResultSingle(modelResponse, ModelWithDetailsSchema, "ModelWithDetails");

  if (!model) {
    notFound();
  }

  const [deploymentsResponse, platformsResponse] = await Promise.all([
    supabase
      .from("model_deployments")
      .select("id, model_id, platform_id, pricing_model, price_per_unit, unit_description, free_tier, one_click, status")
      .eq("model_id", model.id)
      .eq("status", "available"),
    supabase.from("deployment_platforms").select("*").order("name"),
  ]);

  // Fetch historical snapshots for trends
  const { data: snapshotsRaw } = await supabase
    .from("model_snapshots")
    .select("snapshot_date, quality_score, hf_downloads, hf_likes, overall_rank")
    .eq("model_id", model.id)
    .order("snapshot_date", { ascending: true });
  const snapshots = snapshotsRaw ?? [];

  // Fetch similar models (same category, excluding current model)
  const { data: similarRaw } = await supabase
    .from("models")
    .select(
      "id, slug, name, provider, category, overall_rank, quality_score, hf_downloads, parameter_count, is_open_weights"
    )
    .eq("status", "active")
    .eq("category", model.category as import("@/types/database").ModelCategory)
    .neq("id", model.id)
    .order("quality_score", { ascending: false, nullsFirst: false })
    .limit(5);
  const similarModels = similarRaw ?? [];

  // Fetch news linked to this model + provider-level news
  const newsFields = "id, title, summary, url, source, category, related_provider, tags, metadata, published_at";
  const { data: newsRaw } = await supabase.from("model_news").select(newsFields)
    .contains("related_model_ids", [model.id]).order("published_at", { ascending: false }).limit(20);
  const { data: providerNewsRaw } = model.provider
    ? await supabase.from("model_news").select(newsFields).eq("related_provider", model.provider)
        .or("related_model_ids.is.null,related_model_ids.eq.{}").order("published_at", { ascending: false }).limit(10)
    : { data: [] as typeof newsRaw };
  // Merge, deduplicate, sort by date
  const seen = new Set<string>();
  const modelNews = [...(newsRaw ?? []), ...(providerNewsRaw ?? [])]
    .filter((item) => { if (seen.has(item.id)) return false; seen.add(item.id); return true; })
    .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()) as Record<string, unknown>[];

  const catConfig = CATEGORIES.find((c) => c.slug === model.category);
  const displayDescription = getModelDisplayDescription(model);
  const lifecycleBadge = getLifecycleBadge(model.status);
  const parameterDisplay = getParameterDisplay(model);
  const benchmarkScores = model.benchmark_scores ?? [];
  type PricingEntry = import("./_components/pricing-tab").PricingEntry;
  const pricingData = (model.model_pricing ?? []) as PricingEntry[];
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
  const modelAccessOffers = buildAccessOffersCatalog({
    platforms: deploymentPlatforms,
    deployments: deploymentsResponse.data ?? [],
    models: [
      {
        id: model.id,
        slug: model.slug,
        name: model.name,
        provider: model.provider,
        category: model.category,
        quality_score: model.quality_score,
        capability_score: model.capability_score,
        economic_footprint_score: model.economic_footprint_score,
        adoption_score: model.adoption_score,
      },
    ],
  }).offersByModelId[model.id] ?? [];
  const bestAccessOffer = modelAccessOffers[0] ?? null;
  const runtimeExecution = resolveWorkspaceRuntimeExecution(model.slug);
  const deployStartPlan = getDeployStartPlan({
    modelSlug: slug,
    modelName: model.name,
    isOpenWeights: model.is_open_weights,
    allowInSiteWorkspace: runtimeExecution.available,
    offer: bestAccessOffer
      ? {
          actionLabel: bestAccessOffer.actionLabel,
          actionUrl: bestAccessOffer.actionUrl,
          monthlyPrice: bestAccessOffer.monthlyPrice,
          freeTier: bestAccessOffer.freeTier,
          partnerDisclosure: bestAccessOffer.partnerDisclosure,
          platform: {
            slug: bestAccessOffer.platform.slug,
            name: bestAccessOffer.platform.name,
            type: bestAccessOffer.platform.type,
          },
        }
      : null,
  });
  type UpdateEntry = import("./_components/changelog-tab").UpdateEntry;
  const updates = (model.model_updates ?? []) as UpdateEntry[];
  const latestModelUpdateAt =
    typeof modelNews[0]?.published_at === "string"
      ? modelNews[0].published_at
      : typeof updates[0]?.published_at === "string"
        ? updates[0].published_at
        : null;
  type EloEntry = import("./_components/benchmarks-tab").EloRating;
  const eloRatings = (model.elo_ratings ?? []) as EloEntry[];
  const recentBenchmarkEvidence = buildLaunchRadar(
    modelNews.filter((item) => getNewsSignalType(item) === "benchmark"),
    6
  );
  const currentArenaRatings = collapseArenaRatings(eloRatings);
  const benchmarkTracking = getBenchmarkTrackingSummary({
    slug: model.slug,
    provider: model.provider,
    category: model.category,
    benchmarkScoreCount: benchmarkScores.length,
    benchmarkEvidenceCount: countProviderReportedBenchmarkEvidence(
      recentBenchmarkEvidence
    ),
    arenaSignalCount: currentArenaRatings.length,
  });
  const bestElo = currentArenaRatings.length > 0
    ? currentArenaRatings.reduce((best, curr) => (curr.elo_score > best.elo_score ? curr : best), currentArenaRatings[0])
    : null;
  const rawMod: unknown = model.modalities;
  const modalities: string[] = Array.isArray(rawMod)
    ? rawMod as string[]
    : typeof rawMod === "string" ? (rawMod as string).split(",").map((s: string) => s.trim()).filter(Boolean) : [];
  const rawCap = model.capabilities;
  const capabilities: Record<string, boolean> =
    rawCap && typeof rawCap === "object" && !Array.isArray(rawCap) ? (rawCap as Record<string, boolean>) : {};
  const selfHostRequirements = getSelfHostRequirements({
    isOpenWeights: model.is_open_weights,
    parameterCount: model.parameter_count,
    contextWindow: model.context_window,
    modalities,
    category: model.category,
    name: model.name,
    slug: model.slug,
  });

  const stats = [
    { label: "Quality Score", value: model.quality_score ? Number(model.quality_score).toFixed(1) : "---", icon: BarChart3 },
    { label: "Arena ELO", value: bestElo ? String(bestElo.elo_score) : "---", icon: Trophy },
    { label: "Parameters", value: parameterDisplay.label, icon: Zap },
    { label: "Context", value: model.context_window ? formatContextWindow(model.context_window) : "---", icon: MessageSquare },
    { label: "Downloads", value: formatNumber(model.hf_downloads), icon: Download },
    { label: "Likes", value: formatNumber(model.hf_likes), icon: Heart },
    { label: "Released", value: model.release_date ? new Date(model.release_date).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "---", icon: Calendar },
  ];

  const lowestPrice = getCheapestVerifiedPricing({
    id: model.id,
    slug: model.slug,
    name: model.name,
    provider: model.provider,
    overall_rank: model.overall_rank,
    is_open_weights: model.is_open_weights,
    model_pricing: pricingData,
  });
  const modelUrl = `${SITE_URL}/models/${model.slug}`;
  const bestOfferPrice =
    bestAccessOffer?.monthlyPrice != null
      ? bestAccessOffer.monthlyPrice
      : lowestPrice?.input_price_per_million ?? null;
  const modelJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: model.name,
    description: displayDescription.text ?? undefined,
    applicationCategory: "Artificial Intelligence",
    operatingSystem: "Cloud",
    author: { "@type": "Organization", name: model.provider },
    publisher: { "@type": "Organization", name: SITE_NAME },
    mainEntityOfPage: modelUrl,
    url: modelUrl,
    keywords: [
      model.provider,
      model.category,
      ...(modalities ?? []),
      model.is_open_weights ? "open weights" : "closed weights",
    ]
      .filter(Boolean)
      .join(", "),
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
    ...(bestOfferPrice != null && {
      offers: {
        "@type": "Offer",
        url: bestAccessOffer?.actionUrl ?? modelUrl,
        price: bestOfferPrice,
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        seller: {
          "@type": "Organization",
          name: bestAccessOffer?.platform.name ?? model.provider,
        },
      },
    }),
    ...((model.is_open_weights || !!bestAccessOffer?.freeTier) && {
      license: model.license_name ?? "Open Source",
      isAccessibleForFree: true,
    }),
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Models", item: `${SITE_URL}/models` },
      { "@type": "ListItem", position: 3, name: model.name, item: modelUrl },
    ],
  };
  const jsonLd = [modelJsonLd, breadcrumbJsonLd];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <ModelViewTracker modelId={model.id} modelName={model.name} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      {/* Back nav */}
      <Link
        href="/models"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Models
      </Link>

      {/* Header */}
      <ModelHeader
        name={model.name}
        provider={model.provider}
        description={displayDescription.text}
        overall_rank={model.overall_rank}
        is_open_weights={model.is_open_weights}
        website_url={model.website_url}
        slug={model.slug}
        id={model.id}
        catConfig={catConfig}
        hasNews={modelNews.length > 0}
        latestUpdateAt={latestModelUpdateAt}
        selfHostRequirementLabel={selfHostRequirements?.shortLabel ?? null}
        deployActionLabel={deployStartPlan?.label ?? null}
        deployActionHref={deployStartPlan?.href ?? null}
        deployActionExternal={deployStartPlan?.external ?? false}
        deployActionSponsored={deployStartPlan?.sponsored ?? false}
        deployActionWorkspace={deployStartPlan?.workspace ?? null}
      />

      {lifecycleBadge && !lifecycleBadge.rankedByDefault && (
        <Card className="mt-4 border-border/50 bg-card/60">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <Badge variant="outline">{lifecycleBadge.label}</Badge>
            <p className="text-sm text-muted-foreground">
              This model is still tracked for research and discovery, but it is excluded from default public rankings until it returns to active status.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats Row */}
      <ModelStatsRow stats={stats} />

      {/* Model Overview (AI-generated pros/cons) */}
      <div className="mt-8">
        <ModelOverview modelSlug={model.slug} />
      </div>

      {/* Tabs */}
      <Tabs key={activeTab} id="model-tabs" defaultValue={activeTab} className="mt-6">
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

        <TabsContent value="benchmarks" className="mt-6">
          <BenchmarksTab
            benchmarkScores={benchmarkScores}
            eloRatings={eloRatings}
            recentBenchmarkEvidence={recentBenchmarkEvidence}
            benchmarkTracking={benchmarkTracking}
          />
        </TabsContent>

        <TabsContent value="pricing" className="mt-6">
          <PricingTab
            pricingData={pricingData}
            modelProvider={model.provider}
            accessOffers={modelAccessOffers}
          />
        </TabsContent>

        <TabsContent value="deploy" className="mt-6">
          <DeployTab
            modelSlug={model.slug}
            modelName={model.name}
            isOpenWeights={!!model.is_open_weights}
            parameterCount={model.parameter_count}
            contextWindow={model.context_window}
            modalities={modalities}
            category={model.category}
          />
        </TabsContent>

        <TabsContent value="trading" className="mt-6">
          <TradingTab
            modelSlug={model.slug}
            popularity_rank={model.popularity_rank}
            popularity_score={model.popularity_score}
            adoption_score={model.adoption_score}
            economic_footprint_score={model.economic_footprint_score}
            market_cap_estimate={model.market_cap_estimate}
            capability_score={model.capability_score}
            agent_score={model.agent_score}
            github_stars={model.github_stars}
            benchmark_count={benchmarkScores.length}
            arena_family_count={currentArenaRatings.length}
            pricing_source_count={pricingData.length}
          />
        </TabsContent>

        <TabsContent value="trends" className="mt-6">
          <TrendsTab snapshots={snapshots} />
        </TabsContent>

        <TabsContent value="news" className="mt-6" id="model-news-tab">
          <NewsTab modelNews={modelNews} />
        </TabsContent>

        <TabsContent value="details" className="mt-6">
          <DetailsTab
            architecture={model.architecture}
            parameter_label={parameterDisplay.label}
            context_window={model.context_window}
            release_date={model.release_date}
            status={model.status}
            license_name={model.license_name}
            license={model.license}
            is_open_weights={model.is_open_weights}
            is_api_available={model.is_api_available}
            modalities={modalities}
            capabilities={capabilities}
          />
        </TabsContent>

        <TabsContent value="changelog" className="mt-6">
          <ChangelogTab updates={updates} />
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
