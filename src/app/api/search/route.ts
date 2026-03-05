import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { checkPaywall, paywallErrorResponse } from "@/lib/middleware/api-paywall";
import { sanitizeFilterValue } from "@/lib/utils/sanitize";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Rate limit: search endpoints
  const ip = getClientIp(request);
  const rl = rateLimit(`search:${ip}`, RATE_LIMITS.search);
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
        "id, slug, name, provider, category, overall_rank, quality_score, is_open_weights, parameter_count"
      )
      .textSearch("fts", safeQuery)
      .eq("status", "active")
      .order("popularity_score", { ascending: false, nullsFirst: false })
      .limit(limit);

    let models = result.data;
    const error = result.error;

    // Fallback to ilike if FTS returns no results
    if ((!models || models.length === 0) && !error) {
      const { data: ilikeFallback } = await supabase
        .from("models")
        .select(
          "id, slug, name, provider, category, overall_rank, quality_score, is_open_weights, parameter_count"
        )
        .eq("status", "active")
        .or(
          `name.ilike.%${safeQuery}%,provider.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`
        )
        .order("popularity_score", { ascending: false, nullsFirst: false })
        .limit(limit);

      models = ilikeFallback;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Search marketplace listings too
    let marketplace: Array<{ id: string; slug: string; title: string; listing_type: string; price: number | null; avg_rating: number | null }> = [];

    if (includeMarketplace && query.length >= 2) {
      // Try FTS first for marketplace
      let { data: marketplaceResults } = await supabase
        .from("marketplace_listings")
        .select("id, slug, title, listing_type, price, avg_rating")
        .textSearch("fts", safeQuery)
        .eq("status", "active")
        .order("view_count", { ascending: false, nullsFirst: false })
        .limit(4);

      // Fallback to ilike
      if (!marketplaceResults || marketplaceResults.length === 0) {
        const { data: mkIlike } = await supabase
          .from("marketplace_listings")
          .select("id, slug, title, listing_type, price, avg_rating")
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
      data: models ?? [],
      marketplace,
    });
  } catch (err) {
    return handleApiError(err, "api/search");
  }
}
