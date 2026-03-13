import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { checkPaywall, paywallErrorResponse } from "@/lib/middleware/api-paywall";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

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
      .select("*, rankings(*), model_pricing(*)", { count: "exact" })
      .eq("status", "active");

    if (category) query = query.eq("category", category as import("@/types/database").ModelCategory);
    if (openOnly) query = query.eq("is_open_weights", true);
    if (search) query = query.textSearch("fts", search);

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

    query = query.range((page - 1) * limit, page * limit - 1);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data,
      total: count,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (err) {
    return handleApiError(err, "api/models");
  }
}
