import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { checkPaywall, paywallErrorResponse } from "@/lib/middleware/api-paywall";
import { handleApiError } from "@/lib/api-error";
import { collapseArenaRatings } from "@/lib/models/arena-family";
import { buildBenchmarkTrackingSummaryMap } from "@/lib/models/benchmark-tracking-bulk";
import { dedupePublicModelFamilies } from "@/lib/models/public-families";
import { preferDefaultPublicSurfaceReady } from "@/lib/models/public-surface-readiness";
import { getLifecycleStatuses, parseLifecycleFilter } from "@/lib/models/lifecycle";

export const dynamic = "force-dynamic";

const LENS_SORT_MAP: Record<string, { sortCol: string; ascending: boolean }> = {
  capability:         { sortCol: "capability_rank",           ascending: true },
  popularity:         { sortCol: "popularity_rank",           ascending: true },
  adoption:           { sortCol: "adoption_rank",             ascending: true },
  economic:           { sortCol: "economic_footprint_rank",   ascending: true },
  economic_footprint: { sortCol: "economic_footprint_rank",   ascending: true },
  value:              { sortCol: "value_score",               ascending: false },
  usage:              { sortCol: "usage_rank",                ascending: true },
  expert:             { sortCol: "expert_rank",               ascending: true },
  balanced:           { sortCol: "balanced_rank",             ascending: true },
};

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`rankings:${ip}`, RATE_LIMITS.public);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const pw = await checkPaywall(request);
    if (!pw.allowed) return paywallErrorResponse(pw);

    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { searchParams } = new URL(request.url);
    const lens = searchParams.get("lens") || "capability";
    const category = searchParams.get("category");
    const lifecycleFilter = parseLifecycleFilter(searchParams.get("lifecycle"));
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

    const lensConfig = LENS_SORT_MAP[lens];
    if (!lensConfig) {
      return NextResponse.json(
        { error: `Invalid lens. Must be one of: ${Object.keys(LENS_SORT_MAP).join(", ")}` },
        { status: 400 }
      );
    }

    let query = supabase
      .from("models")
      .select(`
        id, slug, name, provider, category, overall_rank, parameter_count, is_open_weights, license, license_name, context_window, release_date,
        hf_downloads, quality_score, capability_score, capability_rank,
        adoption_score, adoption_rank, economic_footprint_score, economic_footprint_rank,
        usage_score, usage_rank, expert_score, expert_rank, balanced_rank,
        popularity_score, popularity_rank, market_cap_estimate, agent_score, agent_rank,
        value_score,
        benchmark_scores(score_normalized, benchmarks(slug, name)),
        model_pricing(input_price_per_million, output_price_per_million, provider_name, median_output_tokens_per_second, source, currency, effective_date, updated_at),
        elo_ratings(elo_score, arena_name)
      `)
      .not(lensConfig.sortCol, "is", null)
      .order(lensConfig.sortCol, { ascending: lensConfig.ascending })
      .range(0, 1999);

    query =
      lifecycleFilter === "all"
        ? query.in("status", getLifecycleStatuses("all"))
        : query.eq("status", "active");

    if (category) {
      query = query.eq("category", category as import("@/types/database").ModelCategory);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const getSortMetric = (model: Record<string, unknown>) => {
      const value = model[lensConfig.sortCol];
      if (typeof value === "number") return value;
      return lensConfig.ascending ? Number.MAX_SAFE_INTEGER : Number.NEGATIVE_INFINITY;
    };

    const rankingPool =
      lifecycleFilter === "all"
        ? data ?? []
        : preferDefaultPublicSurfaceReady(data ?? [], Math.min(limit, 10));

    const uniqueModels = dedupePublicModelFamilies(rankingPool)
      .sort((left, right) => {
        const leftValue = getSortMetric(left as Record<string, unknown>);
        const rightValue = getSortMetric(right as Record<string, unknown>);
        if (leftValue === rightValue) {
          return Number(left.overall_rank ?? Number.MAX_SAFE_INTEGER) - Number(right.overall_rank ?? Number.MAX_SAFE_INTEGER);
        }
        return lensConfig.ascending ? leftValue - rightValue : rightValue - leftValue;
      })
      .slice(0, limit);
    const benchmarkTracking = await buildBenchmarkTrackingSummaryMap(
      supabase as never,
      uniqueModels.map((model) => ({
        id: String(model.id),
        slug: String(model.slug),
        provider: String(model.provider),
        category:
          typeof model.category === "string" || model.category === null
            ? model.category
            : null,
      }))
    );

    return NextResponse.json({
      data: uniqueModels.map((model) => ({
        ...model,
        elo_ratings: collapseArenaRatings(Array.isArray(model.elo_ratings) ? model.elo_ratings : []),
        benchmark_tracking: benchmarkTracking.get(String(model.id)) ?? null,
      })),
      lens,
      lifecycle: lifecycleFilter,
    });
  } catch (err) {
    return handleApiError(err, "api/rankings");
  }
}
