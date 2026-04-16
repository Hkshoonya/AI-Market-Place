import Link from "next/link";

export const dynamic = "force-dynamic";
import {
  ArrowLeft,
  Search,
  ShoppingBag,
  Star,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_MAP } from "@/lib/constants/categories";
import { formatNumber } from "@/lib/format";
import { dedupePublicModelFamilies } from "@/lib/models/public-families";
import { sanitizeFilterValue } from "@/lib/utils/sanitize";
import { createOptionalPublicClient } from "@/lib/supabase/public-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicPricingSummary } from "@/lib/models/pricing";
import { formatMarketValue } from "@/lib/models/market-value";
import { getCapabilityMetricValue } from "@/lib/providers/metrics";
import { pickBestModelSignals, type ModelSignalSummary } from "@/lib/news/model-signals";
import { ModelSignalBadge } from "@/components/models/model-signal-badge";
import { BenchmarkTrackingBadge } from "@/components/models/benchmark-tracking-badge";
import { DeploymentMeaningLegend } from "@/components/models/deployment-meaning-legend";
import { getModelDisplayDescription } from "@/lib/models/presentation";
import { rankModelsForSearch } from "@/lib/models/search-ranking";
import { selectPublicRankingPool } from "@/lib/models/public-ranking-confidence";
import {
  buildBenchmarkTrackingSummaryMap,
} from "@/lib/models/benchmark-tracking-bulk";
import type { BenchmarkTrackingSummary } from "@/lib/models/benchmark-status";
import { summarizeBenchmarkTrackingCoverage } from "@/lib/models/benchmark-status";
import {
  buildAccessOffersCatalog,
  getBestAccessOfferForModel,
} from "@/lib/models/access-offers";
import { getDeployabilityLabel } from "@/lib/models/deployability";
import { getSelfHostRequirements } from "@/lib/models/self-host-requirements";
import {
  getListingCommerceSignals,
  getListingPillClasses,
} from "@/lib/marketplace/presentation";
import { attachListingPolicies } from "@/lib/marketplace/policy-read";
import { SITE_URL } from "@/lib/constants/site";
import { SearchResultsTabs } from "./search-results-tabs";

export const revalidate = 0;

const SEARCH_MODEL_SELECT =
  "id, slug, name, provider, category, overall_rank, quality_score, capability_score, adoption_score, economic_footprint_score, popularity_score, release_date, is_open_weights, parameter_count, short_description, market_cap_estimate";
const SEARCH_MARKETPLACE_SELECT =
  "id, slug, title, listing_type, price, avg_rating, short_description, pricing_type, review_count, preview_manifest, mcp_manifest, agent_config, agent_id";

type SearchModelItem = {
  id: string;
  slug: string;
  name: string;
  provider: string;
  category: string;
  overall_rank: number | null;
  quality_score: number | null;
  capability_score?: number | null;
  economic_footprint_score?: number | null;
  popularity_score: number | null;
  is_open_weights: boolean | null;
  parameter_count: number | null;
  short_description: string | null;
  description?: string | null;
  market_cap_estimate?: number | null;
  model_pricing?: Array<{
    provider_name?: string | null;
    input_price_per_million?: number | null;
    output_price_per_million?: number | null;
    price_per_call?: number | null;
    price_per_gpu_second?: number | null;
    subscription_monthly?: number | null;
    source?: string | null;
    currency?: string | null;
    effective_date?: string | null;
    updated_at?: string | null;
  }> | null;
  recent_signal?: ModelSignalSummary | null;
  self_host_requirement_label?: string | null;
  benchmark_tracking_summary?: BenchmarkTrackingSummary | null;
};

type SearchMarketplaceItem = {
  id: string;
  slug: string;
  title: string;
  listing_type: string;
  price: number | null;
  avg_rating: number | null;
  short_description: string | null;
  pricing_type: string;
  review_count: number | null;
  purchase_mode?: string | null;
  autonomy_mode?: string | null;
  preview_manifest?: Record<string, unknown> | null;
  mcp_manifest?: Record<string, unknown> | null;
  agent_config?: Record<string, unknown> | null;
  agent_id?: string | null;
};

type SearchQueryClient =
  | Exclude<ReturnType<typeof createOptionalPublicClient>, null>
  | ReturnType<typeof createAdminClient>;

async function searchModelsWithFallback(
  queryClient: ReturnType<typeof createAdminClient>,
  safeQuery: string
) {
  const ftsResult = await queryClient
    .from("models")
    .select(SEARCH_MODEL_SELECT, { count: "exact" })
    .textSearch("fts", safeQuery)
    .eq("status", "active")
    .order("popularity_score", { ascending: false, nullsFirst: false })
    .range(0, 1999);

  if (ftsResult.data && ftsResult.data.length > 0) {
    return {
      data: ftsResult.data,
      count: ftsResult.count ?? ftsResult.data.length,
    };
  }

  const ilikeResult = await queryClient
    .from("models")
    .select(SEARCH_MODEL_SELECT, { count: "exact" })
    .eq("status", "active")
    .or(
      `name.ilike.%${safeQuery}%,provider.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`
    )
    .order("popularity_score", { ascending: false, nullsFirst: false })
    .range(0, 1999);

  if (ilikeResult.error) {
    throw ilikeResult.error;
  }

  return {
    data: ilikeResult.data ?? [],
    count: ilikeResult.count ?? 0,
  };
}

async function searchMarketplaceWithFallback(
  queryClient: ReturnType<typeof createAdminClient>,
  safeQuery: string,
  offset: number,
  pageSize: number
) {
  const ftsResult = await queryClient
    .from("marketplace_listings")
    .select(SEARCH_MARKETPLACE_SELECT, { count: "exact" })
    .textSearch("fts", safeQuery)
    .eq("status", "active")
    .order("view_count", { ascending: false, nullsFirst: false })
    .range(offset, offset + pageSize - 1);

  if (ftsResult.data && ftsResult.data.length > 0) {
    return {
      data: ftsResult.data,
      count: ftsResult.count ?? ftsResult.data.length,
    };
  }

  const ilikeResult = await queryClient
    .from("marketplace_listings")
    .select(SEARCH_MARKETPLACE_SELECT, { count: "exact" })
    .eq("status", "active")
    .or(`title.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`)
    .order("view_count", { ascending: false, nullsFirst: false })
    .range(offset, offset + pageSize - 1);

  if (ilikeResult.error) {
    throw ilikeResult.error;
  }

  return {
    data: ilikeResult.data ?? [],
    count: ilikeResult.count ?? 0,
  };
}

async function loadSearchModelResults(
  supabase: SearchQueryClient,
  benchmarkTrackingClient: Parameters<typeof buildBenchmarkTrackingSummaryMap>[0],
  safeQuery: string,
  offset: number,
  pageSize: number
) {
  const { data, count } = await searchModelsWithFallback(supabase, safeQuery);
  const uniqueModels = selectPublicRankingPool(
    rankModelsForSearch(dedupePublicModelFamilies(data ?? []), safeQuery),
    Math.min(pageSize, 5)
  );
  const [
    { data: newsRaw },
    { data: pricingRaw },
    { data: deploymentPlatformsRaw },
    { data: modelDeploymentsRaw },
  ] = await Promise.all([
    supabase
      .from("model_news")
      .select("id, title, source, related_provider, related_model_ids, published_at, metadata")
      .order("published_at", { ascending: false })
      .limit(200),
    uniqueModels.length > 0
      ? supabase
          .from("model_pricing")
          .select(
            "model_id, provider_name, input_price_per_million, output_price_per_million, price_per_call, price_per_gpu_second, subscription_monthly, source, currency, effective_date, updated_at"
          )
          .in("model_id", uniqueModels.map((model) => model.id))
      : Promise.resolve({ data: [], error: null }),
    uniqueModels.length > 0
      ? supabase.from("deployment_platforms").select("*").order("name")
      : Promise.resolve({ data: [], error: null }),
    uniqueModels.length > 0
      ? supabase
          .from("model_deployments")
          .select(
            "id, model_id, platform_id, pricing_model, price_per_unit, unit_description, free_tier, one_click, status"
          )
          .in("model_id", uniqueModels.map((model) => model.id))
          .eq("status", "available")
      : Promise.resolve({ data: [], error: null }),
  ]);
  const modelSignals = pickBestModelSignals(
    uniqueModels,
    (newsRaw ?? []).map((item) => ({
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
    }))
  );
  const pricingByModelId = new Map<
    string,
    Array<{
      provider_name?: string | null;
      input_price_per_million?: number | null;
      output_price_per_million?: number | null;
      price_per_call?: number | null;
      price_per_gpu_second?: number | null;
      subscription_monthly?: number | null;
      source?: string | null;
      currency?: string | null;
      effective_date?: string | null;
      updated_at?: string | null;
    }>
  >();

  for (const entry of pricingRaw ?? []) {
    if (typeof entry.model_id !== "string") continue;
    const existing = pricingByModelId.get(entry.model_id) ?? [];
    existing.push({
      provider_name:
        typeof entry.provider_name === "string" ? entry.provider_name : null,
      input_price_per_million:
        typeof entry.input_price_per_million === "number"
          ? entry.input_price_per_million
          : null,
      output_price_per_million:
        typeof entry.output_price_per_million === "number"
          ? entry.output_price_per_million
          : null,
      price_per_call:
        typeof entry.price_per_call === "number" ? entry.price_per_call : null,
      price_per_gpu_second:
        typeof entry.price_per_gpu_second === "number"
          ? entry.price_per_gpu_second
          : null,
      subscription_monthly:
        typeof entry.subscription_monthly === "number"
          ? entry.subscription_monthly
          : null,
      source: typeof entry.source === "string" ? entry.source : null,
      currency: typeof entry.currency === "string" ? entry.currency : null,
      effective_date:
        typeof entry.effective_date === "string" ? entry.effective_date : null,
      updated_at: typeof entry.updated_at === "string" ? entry.updated_at : null,
    });
    pricingByModelId.set(entry.model_id, existing);
  }

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

  const modelAccessCatalog = buildAccessOffersCatalog({
    platforms: deploymentPlatforms,
    deployments: modelDeploymentsRaw ?? [],
    models: uniqueModels.map((model) => ({
      id: model.id,
      slug: model.slug,
      name: model.name,
      provider: model.provider,
      category: model.category,
      quality_score: model.quality_score,
      capability_score: model.capability_score,
      economic_footprint_score: model.economic_footprint_score,
    })),
  });
  const pagedModels = uniqueModels.slice(offset, offset + pageSize);
  const benchmarkTrackingByModelId = await buildBenchmarkTrackingSummaryMap(
    benchmarkTrackingClient,
    pagedModels.map((model) => ({
      id: model.id,
      slug: model.slug,
      provider: model.provider,
      category: model.category,
    }))
  );
  const modelBenchmarkCoverageSummary = summarizeBenchmarkTrackingCoverage(
    pagedModels.map((model) => benchmarkTrackingByModelId.get(model.id) ?? null)
  );

  return {
    models: pagedModels.map((model) => ({
      ...model,
      model_pricing: pricingByModelId.get(model.id) ?? [],
      recent_signal: modelSignals.get(model.id) ?? null,
      benchmark_tracking_summary: benchmarkTrackingByModelId.get(model.id) ?? null,
    })) as SearchModelItem[],
    modelCount: uniqueModels.length > 0 ? uniqueModels.length : (count ?? 0),
    modelBenchmarkCoverageSummary,
    modelAccessCatalog,
  };
}

async function loadSearchMarketplaceResults(
  supabase: SearchQueryClient,
  admin: ReturnType<typeof createAdminClient>,
  safeQuery: string,
  offset: number,
  pageSize: number
) {
  const { data, count } = await searchMarketplaceWithFallback(
    supabase,
    safeQuery,
    offset,
    pageSize
  );

  return {
    marketplace: (await attachListingPolicies(admin, data ?? [])) as SearchMarketplaceItem[],
    marketplaceCount: count ?? 0,
  };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return {
    title: q ? `Search: ${q}` : "Search",
    description: q
      ? `Search results for "${q}" on AI Market Cap`
      : "Search AI models and marketplace listings",
    alternates: {
      canonical: `${SITE_URL}/search`,
    },
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; tab?: string }>;
}) {
  const { q, page: pageStr, tab } = await searchParams;
  const query = q?.trim() || "";
  const page = Math.max(1, parseInt(pageStr || "1"));
  const activeTab = tab === "marketplace" ? "marketplace" : "models";
  const PAGE_SIZE = 20;

  const admin = createAdminClient();
  const supabase = createOptionalPublicClient() ?? admin;
  const benchmarkTrackingClient =
    supabase as unknown as Parameters<typeof buildBenchmarkTrackingSummaryMap>[0];

  let models: SearchModelItem[] = [];
  let modelCount = 0;
  let modelBenchmarkCoverageSummary = summarizeBenchmarkTrackingCoverage([]);
  let modelAccessCatalog = buildAccessOffersCatalog({
    platforms: [],
    deployments: [],
    models: [],
  });
  let marketplace: SearchMarketplaceItem[] = [];
  let marketplaceCount = 0;

  if (query.length >= 2) {
    const safeQuery = sanitizeFilterValue(query);
    const offset = (page - 1) * PAGE_SIZE;
    const [modelResults, marketplaceResults] = await Promise.all([
      loadSearchModelResults(
        supabase,
        benchmarkTrackingClient,
        safeQuery,
        offset,
        PAGE_SIZE
      ),
      loadSearchMarketplaceResults(supabase, admin, safeQuery, offset, PAGE_SIZE),
    ]);

    models = modelResults.models;
    modelCount = modelResults.modelCount;
    modelBenchmarkCoverageSummary = modelResults.modelBenchmarkCoverageSummary;
    modelAccessCatalog = modelResults.modelAccessCatalog;
    marketplace = marketplaceResults.marketplace;
    marketplaceCount = marketplaceResults.marketplaceCount;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neon/10">
          <Search className="h-5 w-5 text-neon" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Search Results</h1>
          {query && (
            <p className="text-sm text-muted-foreground">
              {modelCount} model results and {marketplaceCount} marketplace results for &ldquo;{query}&rdquo;
            </p>
          )}
        </div>
      </div>

      {/* Search form */}
      <form className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            type="text"
            defaultValue={query}
            placeholder="Search AI models, listings..."
            className="w-full rounded-lg border border-border/50 bg-secondary/30 py-2.5 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-neon/30"
          />
        </div>
      </form>

      <DeploymentMeaningLegend
        className="mb-6"
        intro="Deployment here means the real way to start using a model after you find it, not just a tool name or mention."
      />

      {!query ? (
        <div className="py-16 text-center">
          <Search className="mx-auto h-12 w-12 text-muted-foreground/20" />
          <p className="mt-3 text-muted-foreground">
            Enter a name, provider, or keyword to find models and marketplace listings.
          </p>
        </div>
      ) : (
        <>
          <SearchResultsTabs
            query={query}
            page={page}
            pageSize={PAGE_SIZE}
            initialTab={activeTab}
            modelCount={modelCount}
            marketplaceCount={marketplaceCount}
            modelBenchmarkCoverageSummary={modelBenchmarkCoverageSummary}
            modelsContent={
              <div className="space-y-2">
                {models.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    No models matched &ldquo;{query}&rdquo;.
                  </div>
                ) : (
                  models.map((model) => (
                    (() => {
                      const capabilityValue = getCapabilityMetricValue(model);
                      const pricingSummary = getPublicPricingSummary(model);
                      const accessOffer = getBestAccessOfferForModel(modelAccessCatalog, model.id);
                      const displayDescription = getModelDisplayDescription(model).text;
                      const deployabilityLabel = getDeployabilityLabel({
                        signal: model.recent_signal ?? null,
                        isOpenWeights: model.is_open_weights,
                        accessOffer,
                      });
                      const selfHostRequirementLabel =
                        model.self_host_requirement_label ??
                        getSelfHostRequirements({
                          isOpenWeights: model.is_open_weights,
                          parameterCount: model.parameter_count,
                          name: model.name,
                          slug: model.slug,
                          category: model.category,
                        })?.shortLabel ??
                        null;

                      return (
                        <Link
                          key={model.id}
                          href={`/models/${model.slug}`}
                          className="flex items-center gap-4 rounded-xl border border-border/50 bg-card p-4 transition-colors hover:bg-secondary/20"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-bold text-muted-foreground">
                            {model.overall_rank ? `#${model.overall_rank}` : "—"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{model.name}</span>
                              <span className="text-xs text-muted-foreground">{model.provider}</span>
                              {deployabilityLabel && (
                                <Badge variant="outline" className="text-[10px] border-cyan-500/20 text-cyan-200">
                                  {deployabilityLabel}
                                </Badge>
                              )}
                              <BenchmarkTrackingBadge
                                summary={model.benchmark_tracking_summary}
                              />
                              {model.is_open_weights && (
                                <Badge variant="outline" className="text-[10px] border-gain/30 text-gain">
                                  Open
                                </Badge>
                              )}
                            </div>
                            {displayDescription ? (
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                {displayDescription}
                              </p>
                            ) : null}
                            {selfHostRequirementLabel ? (
                              <p className="mt-1 text-[11px] text-amber-200">
                                {selfHostRequirementLabel}
                              </p>
                            ) : null}
                            {model.recent_signal ? (
                              <div className="mt-2">
                                <ModelSignalBadge signal={model.recent_signal} />
                              </div>
                            ) : null}
                            <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                              <span>
                                {CATEGORY_MAP[model.category as keyof typeof CATEGORY_MAP]?.shortLabel ||
                                  model.category}
                              </span>
                              {model.parameter_count && (
                                <span>{formatNumber(model.parameter_count)} params</span>
                              )}
                              {capabilityValue != null && (
                                <span className="flex items-center gap-0.5">
                                  <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                                  {capabilityValue.toFixed(1)} cap
                                </span>
                              )}
                              {(accessOffer || pricingSummary.compactDisplay) && (
                                <span className="flex items-center gap-0.5">
                                  <Zap className="h-2.5 w-2.5 text-neon" />
                                  {accessOffer ? accessOffer.monthlyPriceLabel : pricingSummary.compactDisplay}
                                </span>
                              )}
                              {model.market_cap_estimate != null && (
                                <span>Value {formatMarketValue(model.market_cap_estimate)}</span>
                              )}
                            </div>
                          </div>
                        </Link>
                      );
                    })()
                  ))
                )}
              </div>
            }
            marketplaceContent={
              <div className="space-y-2">
                {marketplace.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    No marketplace listings matched &ldquo;{query}&rdquo;.
                  </div>
                ) : (
                  marketplace.map((item) => (
                    (() => {
                      const commerceSignals = getListingCommerceSignals(item);

                      return (
                        <Link
                          key={item.id}
                          href={`/marketplace/${item.slug}`}
                          className="flex items-center gap-4 rounded-xl border border-border/50 bg-card p-4 transition-colors hover:bg-secondary/20"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neon/10">
                            <ShoppingBag className="h-5 w-5 text-neon" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{item.title}</span>
                              <Badge variant="outline" className="text-[10px]">
                                {item.listing_type?.replace(/_/g, " ")}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${getListingPillClasses(commerceSignals.autonomy.tone)}`}
                              >
                                {commerceSignals.autonomy.label}
                              </Badge>
                            </div>
                            {item.short_description && (
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                {item.short_description}
                              </p>
                            )}
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${getListingPillClasses(commerceSignals.manifest.tone)}`}
                              >
                                {commerceSignals.manifest.label}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${getListingPillClasses(commerceSignals.seller.tone)}`}
                              >
                                {commerceSignals.seller.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                              {item.price != null && (
                                <span className="font-medium text-foreground">${item.price}</span>
                              )}
                              {item.pricing_type === "free" && (
                                <span className="text-gain font-medium">Free</span>
                              )}
                              {item.avg_rating != null && (
                                <span className="flex items-center gap-0.5">
                                  <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                                  {item.avg_rating.toFixed(1)}
                                </span>
                              )}
                              {(item.review_count ?? 0) > 0 && (
                                <span>{item.review_count} reviews</span>
                              )}
                            </div>
                          </div>
                        </Link>
                      );
                    })()
                  ))
                )}
              </div>
            }
          />
        </>
      )}
    </div>
  );
}
