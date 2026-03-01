import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { checkPaywall, paywallErrorResponse } from "@/lib/middleware/api-paywall";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(`rankings:${ip}`, RATE_LIMITS.public);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  // Paywall check
  const pw = await checkPaywall(request);
  if (!pw.allowed) return paywallErrorResponse(pw);

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "overall";
  const category = searchParams.get("category");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

  let query = supabase
    .from("rankings")
    .select(
      `
      *,
      models!inner(
        id, slug, name, provider, category, parameter_count,
        is_open_weights, hf_downloads, quality_score,
        benchmark_scores(score_normalized, benchmarks(slug, name)),
        model_pricing(input_price_per_million, output_price_per_million, provider_name, median_output_tokens_per_second),
        elo_ratings(elo_score, arena_name)
      )
    `
    )
    .eq("ranking_type", type)
    .order("rank", { ascending: true })
    .limit(limit);

  if (category) {
    query = query.eq("models.category", category);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
