import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { checkPaywall, paywallErrorResponse } from "@/lib/middleware/api-paywall";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const LENS_SORT_MAP: Record<string, { scoreCol: string; rankCol: string }> = {
  capability: { scoreCol: "capability_score", rankCol: "capability_rank" },
  usage:      { scoreCol: "usage_score",      rankCol: "usage_rank" },
  expert:     { scoreCol: "expert_score",     rankCol: "expert_rank" },
  balanced:   { scoreCol: "quality_score",    rankCol: "balanced_rank" },
};

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(`rankings:${ip}`, RATE_LIMITS.public);
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
        id, slug, name, provider, category, parameter_count, is_open_weights,
        hf_downloads, quality_score, capability_score, capability_rank,
        usage_score, usage_rank, expert_score, expert_rank, balanced_rank,
        popularity_score, popularity_rank, market_cap_estimate, agent_score, agent_rank,
        value_score,
        benchmark_scores(score_normalized, benchmarks(slug, name)),
        model_pricing(input_price_per_million, output_price_per_million, provider_name, median_output_tokens_per_second),
        elo_ratings(elo_score, arena_name)
      `)
      .eq("status", "active")
      .not(lensConfig.rankCol, "is", null)
      .order(lensConfig.rankCol, { ascending: true })
      .limit(limit);

    if (category) {
      query = query.eq("category", category as import("@/types/database").ModelCategory);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data, lens });
  } catch (err) {
    return handleApiError(err, "api/rankings");
  }
}
