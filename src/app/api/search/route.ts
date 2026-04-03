import { NextRequest, NextResponse } from "next/server";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { checkPaywall, paywallErrorResponse } from "@/lib/middleware/api-paywall";
import { sanitizeFilterValue } from "@/lib/utils/sanitize";
import { handleApiError } from "@/lib/api-error";
import {
  dedupePublicModelFamilies,
  getPublicSurfaceSeriesKey,
} from "@/lib/models/public-families";
import { getPublicPricingSummary } from "@/lib/models/pricing";
import { pickBestModelSignals } from "@/lib/news/model-signals";
import { getModelDisplayDescription } from "@/lib/models/presentation";
import { rankModelsForSearch } from "@/lib/models/search-ranking";
import {
  buildAccessOffersCatalog,
  getBestAccessOfferForModel,
} from "@/lib/models/access-offers";
import { getDeployabilityLabel as getSharedDeployabilityLabel } from "@/lib/models/deployability";
import {
  buildDeploymentCatalog,
  summarizeUserVisibleDeploymentModes,
} from "@/lib/models/deployments";
import { getSelfHostRequirements } from "@/lib/models/self-host-requirements";
import { attachListingPolicies } from "@/lib/marketplace/policy-read";
import { createAdminClient } from "@/lib/supabase/admin";
import { createOptionalPublicClient } from "@/lib/supabase/public-server";

export const dynamic = "force-dynamic";

const SEARCH_MODEL_SELECT =
  "id, slug, name, provider, category, overall_rank, quality_score, capability_score, is_open_weights, parameter_count, short_description, market_cap_estimate";
const SEARCH_MARKETPLACE_SELECT =
  "id, slug, title, listing_type, price, avg_rating, preview_manifest, mcp_manifest, agent_config, agent_id";

interface SearchModelRow {
  id: string;
  slug: string;
  name: string;
  provider: string;
  category?: string | null;
  overall_rank?: number | null;
  quality_score?: number | null;
  capability_score?: number | null;
  is_open_weights?: boolean | null;
  parameter_count?: number | null;
  short_description?: string | null;
  market_cap_estimate?: number | null;
}

function collapseSearchSurfaceSeries<T extends SearchModelRow>(models: T[], limit: number) {
  const selected: T[] = [];
  const seenSeries = new Set<string>();

  for (const model of models) {
    const key = getPublicSurfaceSeriesKey(model);
    if (seenSeries.has(key)) continue;
    seenSeries.add(key);
    selected.push(model);
    if (selected.length >= limit) break;
  }

  return selected;
}

function normalizeSearchInput(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildSearchVariants(value: string) {
  const normalized = normalizeSearchInput(value);
  const tokens = normalized.split(/\s+/).filter(Boolean);

  return Array.from(
    new Set(
      [
        sanitizeFilterValue(value),
        tokens.join(" "),
        tokens.join("-"),
        tokens.join(""),
      ]
        .map((variant) => variant.trim())
        .filter((variant) => variant.length >= 2)
    )
  );
}

function buildIlikeOrFilter(fields: string[], variants: string[]) {
  return fields
    .flatMap((field) => variants.map((variant) => `${field}.ilike.%${sanitizeFilterValue(variant)}%`))
    .join(",");
}

async function searchModelsWithFallback(
  queryClient: ReturnType<typeof createAdminClient>,
  safeQuery: string,
  limit: number
): Promise<SearchModelRow[]> {
  const variants = buildSearchVariants(safeQuery);
  const ftsQuery = normalizeSearchInput(safeQuery);
  const ilikeFilter = buildIlikeOrFilter(
    ["name", "slug", "provider", "description", "short_description"],
    variants
  );

  const ftsResult = await queryClient
    .from("models")
    .select(SEARCH_MODEL_SELECT)
    .textSearch("fts", ftsQuery || safeQuery)
    .eq("status", "active")
    .order("popularity_score", { ascending: false, nullsFirst: false })
    .limit(Math.min(limit * 4, 50));

  const ilikeResult = await queryClient
    .from("models")
    .select(SEARCH_MODEL_SELECT)
    .eq("status", "active")
    .or(ilikeFilter)
    .order("popularity_score", { ascending: false, nullsFirst: false })
    .limit(Math.min(limit * 4, 50));

  if (ilikeResult.error) {
    throw ilikeResult.error;
  }

  const merged = new Map<string, SearchModelRow>();
  for (const row of ftsResult.data ?? []) {
    if (typeof row.id === "string") merged.set(row.id, row as SearchModelRow);
  }
  for (const row of ilikeResult.data ?? []) {
    if (typeof row.id === "string" && !merged.has(row.id)) {
      merged.set(row.id, row as SearchModelRow);
    }
  }

  return [...merged.values()];
}

async function searchMarketplaceWithFallback(
  queryClient: ReturnType<typeof createAdminClient>,
  safeQuery: string
) {
  const ftsResult = await queryClient
    .from("marketplace_listings")
    .select(SEARCH_MARKETPLACE_SELECT)
    .textSearch("fts", safeQuery)
    .eq("status", "active")
    .order("view_count", { ascending: false, nullsFirst: false })
    .limit(4);

  if (ftsResult.data && ftsResult.data.length > 0) {
    return ftsResult.data;
  }

  const ilikeResult = await queryClient
    .from("marketplace_listings")
    .select(SEARCH_MARKETPLACE_SELECT)
    .eq("status", "active")
    .or(`title.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`)
    .order("view_count", { ascending: false, nullsFirst: false })
    .limit(4);

  if (ilikeResult.error) {
    throw ilikeResult.error;
  }

  return ilikeResult.data ?? [];
}

export async function GET(request: NextRequest) {
  // Rate limit: search endpoints
  const ip = getClientIp(request);
  const rl = await rateLimit(`search:${ip}`, RATE_LIMITS.search);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    // Paywall check
    const pw = await checkPaywall(request);
    if (!pw.allowed) return paywallErrorResponse(pw);

    const admin = createAdminClient();
    const supabase = createOptionalPublicClient() ?? admin;
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);
    const includeMarketplace = searchParams.get("marketplace") !== "false";

    if (!query || query.length < 2) {
      return NextResponse.json({ data: [], marketplace: [] });
    }

    const safeQuery = sanitizeFilterValue(query);
    if (!safeQuery) {
      return NextResponse.json({ data: [], marketplace: [] });
    }

    const models = await searchModelsWithFallback(supabase, query, limit);

    const uniqueModels = collapseSearchSurfaceSeries(
      rankModelsForSearch(dedupePublicModelFamilies(models ?? []), safeQuery),
      limit
    );
    const [
      { data: pricingRows },
      { data: newsRaw },
      { data: deploymentPlatformsRaw },
      { data: modelDeploymentsRaw },
    ] = await Promise.all([
      uniqueModels.length > 0
        ? supabase
            .from("model_pricing")
            .select(
              "model_id, provider_name, input_price_per_million, output_price_per_million, price_per_call, price_per_gpu_second, subscription_monthly, source, currency, effective_date, updated_at"
            )
            .in("model_id", uniqueModels.map((model) => model.id))
        : Promise.resolve({ data: [], error: null }),
      uniqueModels.length > 0
        ? supabase
            .from("model_news")
            .select("id, title, source, related_provider, related_model_ids, published_at, metadata")
            .order("published_at", { ascending: false })
            .limit(120)
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

    for (const row of pricingRows ?? []) {
      if (typeof row.model_id !== "string") continue;
      const existing = pricingByModelId.get(row.model_id) ?? [];
      existing.push({
        provider_name: typeof row.provider_name === "string" ? row.provider_name : null,
        input_price_per_million:
          typeof row.input_price_per_million === "number" ? row.input_price_per_million : null,
        output_price_per_million:
          typeof row.output_price_per_million === "number" ? row.output_price_per_million : null,
        price_per_call: typeof row.price_per_call === "number" ? row.price_per_call : null,
        price_per_gpu_second:
          typeof row.price_per_gpu_second === "number" ? row.price_per_gpu_second : null,
        subscription_monthly:
          typeof row.subscription_monthly === "number" ? row.subscription_monthly : null,
        source: typeof row.source === "string" ? row.source : null,
        currency: typeof row.currency === "string" ? row.currency : null,
        effective_date: typeof row.effective_date === "string" ? row.effective_date : null,
        updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
      });
      pricingByModelId.set(row.model_id, existing);
    }

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
      deployments: modelDeploymentsRaw ?? [],
      models: uniqueModels.map((model) => ({
        id: model.id,
        slug: model.slug,
        name: model.name,
        provider: model.provider,
        category: model.category ?? "llm",
        quality_score: model.quality_score ?? null,
        capability_score: model.capability_score ?? null,
        economic_footprint_score: null,
      })),
    });

    const enrichedModels = uniqueModels.map((model) => {
      const pricingSummary = getPublicPricingSummary({
        ...model,
        overall_rank: model.overall_rank ?? null,
        model_pricing: pricingByModelId.get(model.id) ?? [],
      });
      const recentSignal = modelSignals.get(model.id) ?? null;
      const accessOffer = getBestAccessOfferForModel(accessCatalog, model.id);
      const modelDeployments = (modelDeploymentsRaw ?? [])
        .filter((deployment) => deployment.model_id === model.id)
        .map((deployment) => ({
          id: deployment.id,
          deploy_url: null,
          pricing_model: deployment.pricing_model,
          price_per_unit: deployment.price_per_unit,
          unit_description: deployment.unit_description,
          free_tier: deployment.free_tier,
          one_click: deployment.one_click,
          deployment_platforms:
            deploymentPlatforms.find((platform) => platform.id === deployment.platform_id)!,
        }))
        .filter((deployment) => Boolean(deployment.deployment_platforms));
      const deploymentCatalog = buildDeploymentCatalog({
        model: {
          slug: model.slug,
          name: model.name,
          provider: model.provider,
          is_open_weights: model.is_open_weights ?? null,
        },
        deployments: modelDeployments,
        platforms: deploymentPlatforms,
        pricingProviderNames: (pricingByModelId.get(model.id) ?? [])
          .map((row) => row.provider_name)
          .filter((value): value is string => Boolean(value)),
      });
      const usageModes = summarizeUserVisibleDeploymentModes(
        [...deploymentCatalog.directDeployments, ...deploymentCatalog.relatedPlatforms],
        model.is_open_weights
      );

      return {
        ...model,
        display_description: getModelDisplayDescription(model).text,
        compact_price: pricingSummary.compactPrice,
        compact_price_label: pricingSummary.compactLabel,
        compact_price_display: pricingSummary.compactDisplay,
        recent_signal: recentSignal,
        deployability_label: getSharedDeployabilityLabel({
          isOpenWeights: model.is_open_weights,
          signal: recentSignal,
          accessOffer,
        }),
        usage_mode_labels: usageModes.labels,
        self_host_requirement_label: getSelfHostRequirements({
          isOpenWeights: model.is_open_weights,
          parameterCount: model.parameter_count,
          name: model.name,
          slug: model.slug,
          category: model.category,
        })?.shortLabel ?? null,
      };
    });

    // Search marketplace listings too
    let marketplace: Array<{
      id: string;
      slug: string;
      title: string;
      listing_type: string;
      price: number | null;
      avg_rating: number | null;
      purchase_mode?: string | null;
      autonomy_mode?: string | null;
      preview_manifest?: Record<string, unknown> | null;
      mcp_manifest?: Record<string, unknown> | null;
      agent_config?: Record<string, unknown> | null;
      agent_id?: string | null;
    }> = [];

    if (includeMarketplace && query.length >= 2) {
      const marketplaceResults = await searchMarketplaceWithFallback(supabase, query);

      marketplace = await attachListingPolicies(admin, marketplaceResults ?? []);
    }

    return NextResponse.json({
      data: enrichedModels,
      marketplace,
    });
  } catch (err) {
    return handleApiError(err, "api/search");
  }
}
