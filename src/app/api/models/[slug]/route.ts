import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { checkPaywall, paywallErrorResponse } from "@/lib/middleware/api-paywall";
import { handleApiError } from "@/lib/api-error";
import { collapseArenaRatings } from "@/lib/models/arena-family";
import {
  countProviderReportedBenchmarkEvidence,
  getBenchmarkTrackingSummary,
} from "@/lib/models/benchmark-status";
import { countTrustedStructuredBenchmarkScores } from "@/lib/models/benchmark-score-trust";
import { buildLaunchRadar, getNewsSignalType } from "@/lib/news/presentation";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`model-detail:${ip}`, RATE_LIMITS.public);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
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

    const { slug } = await params;

    const { data, error } = await supabase
      .from("models")
      .select(
        `
        *,
        benchmark_scores(*, benchmarks(*)),
        model_pricing(*),
        elo_ratings(*),
        rankings(*),
        model_updates(*)
      `
      )
      .eq("slug", slug)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Model not found" }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const eloRatings = Array.isArray(data.elo_ratings) ? data.elo_ratings : [];
    const newsFields =
      "id, title, summary, url, source, category, related_provider, related_model_ids, tags, metadata, published_at";
    const { data: modelNewsRaw } = await supabase
      .from("model_news")
      .select(newsFields)
      .contains("related_model_ids", [data.id])
      .order("published_at", { ascending: false })
      .limit(20);
    const { data: providerNewsRaw } = data.provider
      ? await supabase
          .from("model_news")
          .select(newsFields)
          .eq("related_provider", data.provider)
          .or("related_model_ids.is.null,related_model_ids.eq.{}")
          .order("published_at", { ascending: false })
          .limit(10)
      : { data: [] as typeof modelNewsRaw };
    const seenNewsIds = new Set<string>();
    const modelNews = [...(modelNewsRaw ?? []), ...(providerNewsRaw ?? [])]
      .filter((item) => {
        if (!item.id || seenNewsIds.has(item.id)) return false;
        seenNewsIds.add(item.id);
        return true;
      })
      .sort((a, b) => {
        const left = a.published_at ? Date.parse(a.published_at) : 0;
        const right = b.published_at ? Date.parse(b.published_at) : 0;
        return right - left;
      });
    const benchmark_news = buildLaunchRadar(
      modelNews.filter((item) => getNewsSignalType(item) === "benchmark"),
      6
    );
    const benchmark_tracking = getBenchmarkTrackingSummary({
      slug: data.slug,
      provider: data.provider,
      category: data.category,
      trustedBenchmarkScoreCount: countTrustedStructuredBenchmarkScores(
        data.benchmark_scores
      ),
      benchmarkEvidenceCount: countProviderReportedBenchmarkEvidence(benchmark_news),
      arenaSignalCount: eloRatings.length,
    });

    return NextResponse.json({
      ...data,
      elo_ratings: collapseArenaRatings(eloRatings),
      benchmark_news,
      benchmark_tracking,
    });
  } catch (err) {
    return handleApiError(err, "api/models");
  }
}
