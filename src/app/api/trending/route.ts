import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET /api/trending — get trending models based on recent activity
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(`trending:${ip}`, RATE_LIMITS.public);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);
  const category = searchParams.get("category");

  // Get models with the most downloads (as a proxy for trending)
  // and prefer models with high trending scores or recent releases
  let query = supabase
    .from("models")
    .select(
      "id, slug, name, provider, category, overall_rank, quality_score, hf_downloads, hf_likes, hf_trending_score, release_date, parameter_count, is_open_weights"
    )
    .eq("status", "active");

  if (category) {
    query = query.eq("category", category);
  }

  // Sort by trending score (if available), then by downloads
  query = query
    .order("hf_trending_score", { ascending: false, nullsFirst: false })
    .order("hf_downloads", { ascending: false, nullsFirst: false })
    .limit(limit);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also get "newest" models (released in last 90 days with good quality)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  let recentQuery = supabase
    .from("models")
    .select(
      "id, slug, name, provider, category, overall_rank, quality_score, hf_downloads, release_date, parameter_count, is_open_weights"
    )
    .eq("status", "active")
    .gte("release_date", ninetyDaysAgo.toISOString().split("T")[0])
    .order("quality_score", { ascending: false, nullsFirst: false })
    .limit(6);

  if (category) {
    recentQuery = recentQuery.eq("category", category);
  }

  const { data: recentModels } = await recentQuery;

  // Get "most popular" by download count
  let popularQuery = supabase
    .from("models")
    .select(
      "id, slug, name, provider, category, overall_rank, quality_score, hf_downloads, hf_likes, parameter_count, is_open_weights"
    )
    .eq("status", "active")
    .order("hf_downloads", { ascending: false, nullsFirst: false })
    .limit(6);

  if (category) {
    popularQuery = popularQuery.eq("category", category);
  }

  const { data: popularModels } = await popularQuery;

  // Get "most discussed" — models with most news mentions recently
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: discussedModels } = await (supabase.rpc as any)(
    "get_most_discussed_models",
    { days_back: 30, result_limit: limit }
  );

  // Map discussed models to the same shape as other tabs
  const discussed = (discussedModels ?? []).map(
    (m: {
      model_id: string;
      mention_count: number;
      model_name: string;
      model_slug: string;
      model_provider: string;
      quality_score: number | null;
    }) => ({
      id: m.model_id,
      slug: m.model_slug,
      name: m.model_name,
      provider: m.model_provider,
      quality_score: m.quality_score,
      mention_count: m.mention_count,
      category: null,
      overall_rank: null,
      hf_downloads: 0,
      parameter_count: null,
      is_open_weights: false,
    })
  );

  return NextResponse.json({
    trending: data ?? [],
    recent: recentModels ?? [],
    popular: popularModels ?? [],
    discussed,
  });
}
