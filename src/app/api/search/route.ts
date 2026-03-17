import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { checkPaywall, paywallErrorResponse } from "@/lib/middleware/api-paywall";
import { sanitizeFilterValue } from "@/lib/utils/sanitize";
import { handleApiError } from "@/lib/api-error";
import { dedupePublicModelFamilies } from "@/lib/models/public-families";
import { getPublicPricingSummary } from "@/lib/models/pricing";
import { pickBestModelSignals } from "@/lib/news/model-signals";
import { getModelDisplayDescription } from "@/lib/models/presentation";
import { rankModelsForSearch } from "@/lib/models/search-ranking";

export const dynamic = "force-dynamic";

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

    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
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

    // Try FTS first for models
    const result = await supabase
      .from("models")
      .select(
        "id, slug, name, provider, category, overall_rank, quality_score, capability_score, is_open_weights, parameter_count, short_description, market_cap_estimate"
      )
      .textSearch("fts", safeQuery)
      .eq("status", "active")
      .order("popularity_score", { ascending: false, nullsFirst: false })
      .limit(Math.min(limit * 4, 50));

    let models = result.data;
    const error = result.error;

    // Fallback to ilike if FTS returns no results
    if ((!models || models.length === 0) && !error) {
      const { data: ilikeFallback } = await supabase
        .from("models")
        .select(
          "id, slug, name, provider, category, overall_rank, quality_score, capability_score, is_open_weights, parameter_count, short_description, market_cap_estimate"
        )
        .eq("status", "active")
        .or(
          `name.ilike.%${safeQuery}%,provider.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`
        )
        .order("popularity_score", { ascending: false, nullsFirst: false })
        .limit(Math.min(limit * 4, 50));

      models = ilikeFallback;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const uniqueModels = rankModelsForSearch(
      dedupePublicModelFamilies(models ?? []),
      safeQuery
    ).slice(0, limit);
    const [{ data: pricingRows }, { data: newsRaw }] = await Promise.all([
      uniqueModels.length > 0
        ? supabase
            .from("model_pricing")
            .select(
              "model_id, provider_name, input_price_per_million, output_price_per_million, source, currency"
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
    ]);

    const pricingByModelId = new Map<
      string,
      Array<{
        provider_name?: string | null;
        input_price_per_million?: number | null;
        output_price_per_million?: number | null;
        source?: string | null;
        currency?: string | null;
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
        source: typeof row.source === "string" ? row.source : null,
        currency: typeof row.currency === "string" ? row.currency : null,
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

    const enrichedModels = uniqueModels.map((model) => {
      const pricingSummary = getPublicPricingSummary({
        ...model,
        model_pricing: pricingByModelId.get(model.id) ?? [],
      });

      return {
        ...model,
        display_description: getModelDisplayDescription(model).text,
        compact_price: pricingSummary.compactPrice,
        compact_price_label: pricingSummary.compactLabel,
        recent_signal: modelSignals.get(model.id) ?? null,
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
      // Try FTS first for marketplace
      let { data: marketplaceResults } = await supabase
        .from("marketplace_listings")
        .select(
          "id, slug, title, listing_type, price, avg_rating, purchase_mode, autonomy_mode, preview_manifest, mcp_manifest, agent_config, agent_id"
        )
        .textSearch("fts", safeQuery)
        .eq("status", "active")
        .order("view_count", { ascending: false, nullsFirst: false })
        .limit(4);

      // Fallback to ilike
      if (!marketplaceResults || marketplaceResults.length === 0) {
        const { data: mkIlike } = await supabase
          .from("marketplace_listings")
          .select(
            "id, slug, title, listing_type, price, avg_rating, purchase_mode, autonomy_mode, preview_manifest, mcp_manifest, agent_config, agent_id"
          )
          .eq("status", "active")
          .or(
            `title.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`
          )
          .order("view_count", { ascending: false, nullsFirst: false })
          .limit(4);
        marketplaceResults = mkIlike;
      }

      marketplace = marketplaceResults ?? [];
    }

    return NextResponse.json({
      data: enrichedModels,
      marketplace,
    });
  } catch (err) {
    return handleApiError(err, "api/search");
  }
}
