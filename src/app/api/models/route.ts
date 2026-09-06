import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
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
  try {
    // Paywall check
    const pw = await checkPaywall(request);
    if (!pw.allowed) return paywallErrorResponse(pw);

    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { searchParams } = new URL(request.url);
    const catalogView = searchParams.get("view") === "catalog";
    if (catalogView && !pw.planSlug) {
      return NextResponse.json({ error: "Catalog access requires a data API key. Create an Explorer key to get started." }, { status: 401 });
    }
    const category = searchParams.get("category");
    const sort = searchParams.get("sort") || "rank";
    const requestedPage = Number.parseInt(searchParams.get("page") || "1", 10);
    const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const requestedLimit = Number.parseInt(searchParams.get("limit") || "20", 10);
    const limit = Math.min(
      Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : 20,
      pw.maxPageSize ?? 100
    );
    if (!Number.isSafeInteger(page) || (page - 1) * limit > 1_000_000) {
      return NextResponse.json({ error: "Page is out of range" }, { status: 400 });
    }
    const search = searchParams.get("q");
    const openOnly = searchParams.get("open") === "true";

    let query = supabase
      .from("models")
      .select("*", catalogView ? { count: "exact" } : undefined)
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

    if (catalogView) {
      const offset = (page - 1) * limit;
      const { data, count, error } = await query.order("id", { ascending: true }).range(offset, offset + limit - 1);
      if (error) throw error;
      return NextResponse.json({
        data: (data ?? []).map((model) => ({ ...model, fts: undefined })),
        total: count ?? 0, page, limit, totalPages: Math.ceil((count ?? 0) / limit),
        view: "catalog",
        coverage: "Active catalog records, including variants and models with incomplete data. Missing scores are not zero scores.",
        access: { plan: pw.planSlug, quotaRemaining: pw.quotaRemaining, quotaLimit: pw.quotaLimit },
      }, { headers: { "Cache-Control": "private, no-store", Vary: "Authorization, Cookie" } });
    }

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
