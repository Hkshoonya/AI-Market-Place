import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";
import {
  computePopularDiscoveryScore,
  computeTrendingDiscoveryScore,
  sortRecentReleaseCandidates,
  sortByDiscoveryScore,
} from "@/lib/models/discovery";
import { dedupePublicModelFamilies } from "@/lib/models/public-families";
import { buildModelNewsEvidenceMap } from "@/lib/news/evidence";
import { pickBestModelSignals } from "@/lib/news/model-signals";

export const dynamic = "force-dynamic";

// GET /api/trending — get trending models based on recent activity
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`trending:${ip}`, RATE_LIMITS.public);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);
    const category = searchParams.get("category");

    let query = supabase
      .from("models")
      .select(
        "id, slug, name, provider, category, overall_rank, quality_score, popularity_score, adoption_score, economic_footprint_score, hf_downloads, hf_likes, hf_trending_score, release_date, parameter_count, is_open_weights"
      )
      .eq("status", "active");

    if (category) {
      query = query.eq("category", category as import("@/types/database").ModelCategory);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const visibleModels = dedupePublicModelFamilies(data ?? []);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: coverageNewsRaw } = await supabase
      .from("model_news")
      .select("related_model_ids, source, category, metadata")
      .gte("published_at", thirtyDaysAgo.toISOString())
      .not("related_model_ids", "is", null)
      .order("published_at", { ascending: false })
      .limit(800);

    const discussedEvidence = buildModelNewsEvidenceMap(
      ((coverageNewsRaw ?? []) as Array<Record<string, unknown>>).map((item) => ({
        related_model_ids: Array.isArray(item.related_model_ids)
          ? (item.related_model_ids as string[])
          : null,
        source: typeof item.source === "string" ? item.source : null,
        category: typeof item.category === "string" ? item.category : null,
        metadata:
          item.metadata && typeof item.metadata === "object"
            ? (item.metadata as Record<string, unknown>)
            : null,
      }))
    );

    const discussedIds = [...discussedEvidence.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, limit * 4)
      .map(([modelId]) => modelId);

    let discussed: Array<{
      id: string;
      slug: string;
      name: string;
      provider: string;
      category: string | null;
      overall_rank: number | null;
      quality_score: number | null;
      hf_downloads: number;
      parameter_count: number | null;
      is_open_weights: boolean;
      coverage_score: number;
    }> = [];

    if (discussedIds.length > 0) {
      let discussedQuery = supabase
        .from("models")
        .select(
          "id, slug, name, provider, category, overall_rank, quality_score, hf_downloads, parameter_count, is_open_weights"
        )
        .eq("status", "active")
        .in("id", discussedIds);

      if (category) {
        discussedQuery = discussedQuery.eq(
          "category",
          category as import("@/types/database").ModelCategory
        );
      }

      const { data: discussedModels } = await discussedQuery;
      const discussedById = new Map((discussedModels ?? []).map((model) => [model.id, model]));

      discussed = discussedIds
        .map((modelId) => {
          const model = discussedById.get(modelId);
          if (!model) return null;
          return {
            ...model,
            coverage_score: discussedEvidence.get(modelId) ?? 0,
          };
        })
        .filter((model): model is NonNullable<typeof model> => Boolean(model));
    }

    const trending = sortByDiscoveryScore(visibleModels, (model) =>
      computeTrendingDiscoveryScore(model)
    ).slice(0, limit);

    const popular = sortByDiscoveryScore(visibleModels, (model) =>
      computePopularDiscoveryScore(model)
    ).slice(0, limit);

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const recent = sortRecentReleaseCandidates(
      visibleModels.filter((model) => {
        const releaseDate = model.release_date;
        if (!releaseDate) return false;
        return Date.parse(releaseDate) >= ninetyDaysAgo.getTime();
      })
    ).slice(0, Math.min(limit, 8));

    const discussedUnique = dedupePublicModelFamilies(discussed);
    const combinedModels = dedupePublicModelFamilies([
      ...trending,
      ...popular,
      ...recent,
      ...discussedUnique,
    ]);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const { data: recentNewsRaw } = await supabase
      .from("model_news")
      .select(
        "id, title, source, related_provider, related_model_ids, published_at, metadata"
      )
      .gte("published_at", fourteenDaysAgo.toISOString())
      .order("published_at", { ascending: false })
      .limit(250);

    const modelSignals = pickBestModelSignals(
      combinedModels,
      ((recentNewsRaw ?? []) as Array<Record<string, unknown>>).map((item) => ({
        id: typeof item.id === "string" ? item.id : null,
        title: typeof item.title === "string" ? item.title : null,
        source: typeof item.source === "string" ? item.source : null,
        related_provider:
          typeof item.related_provider === "string" ? item.related_provider : null,
        related_model_ids: Array.isArray(item.related_model_ids)
          ? (item.related_model_ids as string[])
          : null,
        published_at:
          typeof item.published_at === "string" ? item.published_at : null,
        metadata:
          item.metadata && typeof item.metadata === "object"
            ? (item.metadata as Record<string, unknown>)
            : null,
      }))
    );

    const attachSignal = <T extends { id: string }>(modelsWithScores: T[]) =>
      modelsWithScores.map((model) => ({
        ...model,
        recent_signal: modelSignals.get(model.id) ?? null,
      }));

    return NextResponse.json({
      trending: attachSignal(trending),
      recent: attachSignal(recent),
      popular: attachSignal(popular),
      discussed: attachSignal(discussedUnique.slice(0, limit)),
    });
  } catch (err) {
    return handleApiError(err, "api/trending");
  }
}
