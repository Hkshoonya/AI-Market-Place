import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { checkPaywall, paywallErrorResponse } from "@/lib/middleware/api-paywall";
import { handleApiError } from "@/lib/api-error";
import { dedupePublicModelFamilies } from "@/lib/models/public-families";
import { preferDefaultPublicSurfaceReady } from "@/lib/models/public-surface-readiness";
import { buildBenchmarkTrackingSummaryMap } from "@/lib/models/benchmark-tracking-bulk";

export const dynamic = "force-dynamic";

function buildModelSearchFilter(rawSearch: string) {
  const normalized = rawSearch
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const variants = Array.from(
    new Set(
      [
        rawSearch.replace(/[^a-zA-Z0-9 -]/g, "").trim(),
        tokens.join(" "),
        tokens.join("-"),
        tokens.join(""),
      ].filter((variant) => variant.length >= 2)
    )
  );

  return ["name", "slug", "provider", "description", "short_description"]
    .flatMap((field) => variants.map((variant) => `${field}.ilike.%${variant}%`))
    .join(",");
}

export async function GET(request: NextRequest) {
  // Rate limit: public endpoints
  const ip = getClientIp(request);
  const rl = await rateLimit(`models:${ip}`, RATE_LIMITS.public);
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
    const category = searchParams.get("category");
    const sort = searchParams.get("sort") || "rank";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const search = searchParams.get("q");
    const openOnly = searchParams.get("open") === "true";

    let query = supabase
      .from("models")
      .select("*")
      .eq("status", "active");

    if (category) query = query.eq("category", category as import("@/types/database").ModelCategory);
    if (openOnly) query = query.eq("is_open_weights", true);
    if (search) {
      const searchFilter = buildModelSearchFilter(search);
      if (searchFilter) query = query.or(searchFilter);
    }

    // Sorting
    const sortMap: Record<string, { column: string; ascending: boolean }> = {
      rank: { column: "balanced_rank", ascending: true },
      capability: { column: "capability_rank", ascending: true },
      usage: { column: "usage_rank", ascending: true },
      expert: { column: "expert_rank", ascending: true },
      popular: { column: "popularity_score", ascending: false },
      newest: { column: "release_date", ascending: false },
      downloads: { column: "hf_downloads", ascending: false },
      quality: { column: "quality_score", ascending: false },
    };

    const sortConfig = sortMap[sort] || sortMap.rank;
    query = query.order(sortConfig.column, {
      ascending: sortConfig.ascending,
      nullsFirst: false,
    });

    query = query.range(0, 1999);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const filteredData = preferDefaultPublicSurfaceReady(
      data ?? [],
      search ? Math.min(limit, 3) : Math.min(limit, 5)
    );
    const uniqueModels = dedupePublicModelFamilies(filteredData);
    const total = uniqueModels.length;
    const pagedCandidateModels = uniqueModels.slice((page - 1) * limit, page * limit);
    const pagedModelIds = pagedCandidateModels.map((model) => String(model.id));
    const { data: pagedModelDetails, error: pagedModelDetailsError } =
      pagedModelIds.length > 0
        ? await supabase
            .from("models")
            .select("*, rankings(*), model_pricing(*)")
            .in("id", pagedModelIds)
        : { data: [], error: null };

    if (pagedModelDetailsError) {
      return NextResponse.json({ error: pagedModelDetailsError.message }, { status: 500 });
    }

    const pagedModelDetailsById = new Map(
      (pagedModelDetails ?? []).map((model) => [String(model.id), model])
    );
    const pagedModels = pagedCandidateModels.map(
      (model) => pagedModelDetailsById.get(String(model.id)) ?? model
    );
    const benchmarkTracking = await buildBenchmarkTrackingSummaryMap(
      supabase as never,
      pagedModels.map((model) => ({
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
      data: pagedModels.map((model) => ({
        ...model,
        benchmark_tracking: benchmarkTracking.get(String(model.id)) ?? null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    return handleApiError(err, "api/models");
  }
}
