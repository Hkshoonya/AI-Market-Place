import Link from "next/link";

export const dynamic = "force-dynamic";
import {
  ArrowLeft,
  Box,
  Search,
  ShoppingBag,
  Star,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_MAP } from "@/lib/constants/categories";
import { formatNumber, formatTokenPrice } from "@/lib/format";
import { dedupePublicModelFamilies } from "@/lib/models/public-families";
import { sanitizeFilterValue } from "@/lib/utils/sanitize";
import { createPublicClient } from "@/lib/supabase/public-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicPricingSummary } from "@/lib/models/pricing";
import { formatMarketValue } from "@/lib/models/market-value";
import { getCapabilityMetricValue } from "@/lib/providers/metrics";
import { pickBestModelSignals, type ModelSignalSummary } from "@/lib/news/model-signals";
import { ModelSignalBadge } from "@/components/models/model-signal-badge";
import { getModelDisplayDescription } from "@/lib/models/presentation";
import { rankModelsForSearch } from "@/lib/models/search-ranking";
import {
  getListingCommerceSignals,
  getListingPillClasses,
} from "@/lib/marketplace/presentation";
import { attachListingPolicies } from "@/lib/marketplace/policy-read";

export const revalidate = 0;

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

  const supabase = createPublicClient();
  const admin = createAdminClient();

  let models: Array<{
    id: string;
    slug: string;
    name: string;
    provider: string;
    category: string;
    overall_rank: number | null;
    quality_score: number | null;
    capability_score?: number | null;
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
      source?: string | null;
      currency?: string | null;
      effective_date?: string | null;
      updated_at?: string | null;
    }> | null;
    recent_signal?: ModelSignalSummary | null;
  }> = [];
  let modelCount = 0;
  let marketplace: Array<{
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
  }> = [];
  let marketplaceCount = 0;

  if (query.length >= 2) {
    const safeQuery = sanitizeFilterValue(query);
    const offset = (page - 1) * PAGE_SIZE;

    if (activeTab === "models") {
      // Search models
      const modelQuery = supabase
        .from("models")
        .select(
          "id, slug, name, provider, category, overall_rank, quality_score, capability_score, popularity_score, is_open_weights, parameter_count, short_description, market_cap_estimate",
          { count: "exact" }
        )
        .eq("status", "active")
        .or(
          `name.ilike.%${safeQuery}%,provider.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`
        )
        .order("popularity_score", { ascending: false, nullsFirst: false })
        .range(0, 1999);

      const { data, count } = await modelQuery;
      const uniqueModels = rankModelsForSearch(
        dedupePublicModelFamilies(data ?? []),
        safeQuery
      );
      const [{ data: newsRaw }, { data: pricingRaw }] = await Promise.all([
        supabase
          .from("model_news")
          .select("id, title, source, related_provider, related_model_ids, published_at, metadata")
          .order("published_at", { ascending: false })
          .limit(200),
        uniqueModels.length > 0
          ? supabase
              .from("model_pricing")
              .select(
                "model_id, provider_name, input_price_per_million, output_price_per_million, source, currency, effective_date, updated_at"
              )
              .in("model_id", uniqueModels.map((model) => model.id))
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
          source: typeof entry.source === "string" ? entry.source : null,
          currency: typeof entry.currency === "string" ? entry.currency : null,
          effective_date:
            typeof entry.effective_date === "string" ? entry.effective_date : null,
          updated_at: typeof entry.updated_at === "string" ? entry.updated_at : null,
        });
        pricingByModelId.set(entry.model_id, existing);
      }

      models = uniqueModels.slice(offset, offset + PAGE_SIZE).map((model) => ({
        ...model,
        model_pricing: pricingByModelId.get(model.id) ?? [],
        recent_signal: modelSignals.get(model.id) ?? null,
      }));
      modelCount = uniqueModels.length > 0 ? uniqueModels.length : (count ?? 0);
    }

    if (activeTab === "marketplace") {
      // Search marketplace
      const mkQuery = supabase
        .from("marketplace_listings")
        .select(
          "id, slug, title, listing_type, price, avg_rating, short_description, pricing_type, review_count, preview_manifest, mcp_manifest, agent_config, agent_id",
          { count: "exact" }
        )
        .eq("status", "active")
        .or(
          `title.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`
        )
        .order("view_count", { ascending: false, nullsFirst: false })
        .range(offset, offset + PAGE_SIZE - 1);

      const { data, count } = await mkQuery;
      marketplace = await attachListingPolicies(admin, data ?? []);
      marketplaceCount = count ?? 0;
    }

    // Get counts for both tabs
    if (activeTab === "models") {
      const { count } = await supabase
        .from("marketplace_listings")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .or(`title.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`);
      marketplaceCount = count ?? 0;
    } else {
      const { count } = await supabase
        .from("models")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .or(`name.ilike.%${safeQuery}%,provider.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`);
      modelCount = count ?? 0;
    }
  }

  const totalCount = activeTab === "models" ? modelCount : marketplaceCount;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

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
              {totalCount} results for &ldquo;{query}&rdquo;
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

      {!query ? (
        <div className="py-16 text-center">
          <Search className="mx-auto h-12 w-12 text-muted-foreground/20" />
          <p className="mt-3 text-muted-foreground">Enter a search term to find AI models and marketplace listings</p>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-1 mb-6">
            <Link
              href={`/search?q=${encodeURIComponent(query)}&tab=models`}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "models"
                  ? "bg-neon/10 text-neon"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              <Box className="h-4 w-4" />
              Models ({modelCount})
            </Link>
            <Link
              href={`/search?q=${encodeURIComponent(query)}&tab=marketplace`}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "marketplace"
                  ? "bg-neon/10 text-neon"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              <ShoppingBag className="h-4 w-4" />
              Marketplace ({marketplaceCount})
            </Link>
          </div>

          {/* Results */}
          {activeTab === "models" ? (
            <div className="space-y-2">
              {models.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No models found for &ldquo;{query}&rdquo;
                </div>
              ) : (
                models.map((model) => (
                  (() => {
                    const capabilityValue = getCapabilityMetricValue(model);
                    const pricingSummary = getPublicPricingSummary(model);
                    const displayDescription = getModelDisplayDescription(model).text;

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
                            {pricingSummary.compactPrice != null && (
                              <span className="flex items-center gap-0.5">
                                <Zap className="h-2.5 w-2.5 text-neon" />
                                {pricingSummary.compactPrice === 0
                                  ? "Free"
                                  : `${formatTokenPrice(pricingSummary.compactPrice)}/M`}
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
          ) : (
            <div className="space-y-2">
              {marketplace.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No listings found for &ldquo;{query}&rdquo;
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
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={`/search?q=${encodeURIComponent(query)}&tab=${activeTab}&page=${page - 1}`}
                    className="rounded-lg border border-border/50 px-3 py-1.5 text-sm hover:bg-secondary transition-colors"
                  >
                    Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`/search?q=${encodeURIComponent(query)}&tab=${activeTab}&page=${page + 1}`}
                    className="rounded-lg border border-border/50 px-3 py-1.5 text-sm hover:bg-secondary transition-colors"
                  >
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
