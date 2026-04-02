import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";
import {
  computePopularDiscoveryScore,
  computeTrendingDiscoveryScore,
  isHighSignalRecentCandidate,
  sortRecentReleaseCandidates,
  sortByDiscoveryScore,
} from "@/lib/models/discovery";
import {
  collapsePublicModelFamilies,
  dedupePublicModelFamilies,
} from "@/lib/models/public-families";
import { buildModelNewsEvidenceMap } from "@/lib/news/evidence";
import { pickBestModelSignals } from "@/lib/news/model-signals";
import {
  getNewsSignalImportance,
  getNewsSignalType,
} from "@/lib/news/presentation";
import { getCanonicalProviderName } from "@/lib/constants/providers";

export const dynamic = "force-dynamic";

function toTimestamp(value: string | null | undefined) {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function rankByOrderedFamilySelection<
  T extends {
    id: string;
    slug: string;
    name: string;
    provider: string;
    category?: string | null;
    overall_rank?: number | null;
    quality_score?: number | null;
    capability_score?: number | null;
    popularity_score?: number | null;
    adoption_score?: number | null;
    economic_footprint_score?: number | null;
    hf_downloads?: number | null;
  }
>(models: T[], compare: (left: T, right: T) => number) {
  return collapsePublicModelFamilies(models)
    .map((family) => ({
      representative: [...family.variants].sort(compare)[0] ?? family.representative,
    }))
    .map((family) => family.representative)
    .sort(compare);
}

function getRecentSignalWeight(item: {
  published_at?: string | null;
  metadata?: Record<string, unknown> | null;
  source?: string | null;
  category?: string | null;
}) {
  if (
    item.source === "provider-deployment-signals" ||
    item.source === "ollama-library"
  ) {
    return 0;
  }

  const signalType = getNewsSignalType(item);
  if (
    signalType !== "launch" &&
    signalType !== "pricing" &&
    signalType !== "api" &&
    signalType !== "open_source"
  ) {
    return 0;
  }

  const importance = getNewsSignalImportance(item);
  const ageHours = Math.max(0, (Date.now() - toTimestamp(item.published_at)) / 3_600_000);
  const recencyScore = Math.max(0, 72 - Math.min(ageHours, 72));
  const importanceScore = importance === "high" ? 3 : importance === "medium" ? 2 : 1;
  const typeScore = signalType === "launch" ? 3 : signalType === "pricing" ? 2 : 1;

  return recencyScore + importanceScore * 12 + typeScore * 10;
}

function buildDirectModelSignals(
  items: Array<{
    title?: string | null;
    source?: string | null;
    related_provider?: string | null;
    related_model_ids?: string[] | null;
    published_at?: string | null;
    metadata?: Record<string, unknown> | null;
    category?: string | null;
  }>
) {
  const selected = new Map<
    string,
    {
      score: number;
      summary: {
        title: string;
        signalType: string;
        signalLabel: string;
        signalImportance: "high" | "medium" | "low";
        publishedAt: string | null;
        source: string | null;
        relatedProvider: string | null;
      };
    }
  >();

  for (const item of items) {
    const signalType = getNewsSignalType(item);
    if (signalType === "general") continue;

    const signalLabel =
      signalType === "launch"
        ? "Launch"
        : signalType === "pricing"
          ? "Pricing"
          : signalType === "benchmark"
            ? "Benchmark"
            : signalType === "api"
              ? "API"
              : signalType === "open_source"
                ? "Open Source"
                : signalType === "safety"
                  ? "Safety"
                  : "Research";
    const importance = getNewsSignalImportance(item);
    const score =
      toTimestamp(item.published_at) +
      (importance === "high" ? 30 : importance === "medium" ? 20 : 10);

    for (const modelId of item.related_model_ids ?? []) {
      const existing = selected.get(modelId);
      if (existing && existing.score >= score) continue;
      selected.set(modelId, {
        score,
        summary: {
          title: item.title ?? "Recent update",
          signalType,
          signalLabel,
          signalImportance: importance,
          publishedAt: item.published_at ?? null,
          source: item.source ?? null,
          relatedProvider: item.related_provider ?? null,
        },
      });
    }
  }

  return new Map([...selected.entries()].map(([modelId, value]) => [modelId, value.summary]));
}

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
        "id, slug, name, provider, category, overall_rank, quality_score, capability_score, popularity_score, adoption_score, economic_footprint_score, hf_downloads, hf_likes, hf_trending_score, release_date, created_at, parameter_count, is_open_weights"
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

    const popular = sortByDiscoveryScore(visibleModels, (model) =>
      computePopularDiscoveryScore(model)
    ).slice(0, limit);

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

    const recentNewsItems = ((recentNewsRaw ?? []) as Array<Record<string, unknown>>).map((item) => ({
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
    }));

    const recentSignalScores = new Map<string, number>();
    for (const item of recentNewsItems) {
      const weight = getRecentSignalWeight(item);
      if (weight <= 0) continue;

      for (const modelId of item.related_model_ids ?? []) {
        const existing = recentSignalScores.get(modelId) ?? 0;
        if (weight > existing) {
          recentSignalScores.set(modelId, weight);
        }
      }
    }

    const recentCandidates = (data ?? [])
      .filter((model) => {
        const releaseDate =
          model.release_date ??
          (typeof model.created_at === "string" && model.provider ? model.created_at : null);
        if (!releaseDate) return false;
        return Date.parse(releaseDate) >= thirtyDaysAgo.getTime();
      })
      .map((model) => ({
        ...model,
        recent_signal_score: recentSignalScores.get(model.id) ?? 0,
      }))
      .filter((model) => isHighSignalRecentCandidate(model));

    const recent = rankByOrderedFamilySelection(
      sortRecentReleaseCandidates(recentCandidates),
      (left, right) => {
        const scoreDelta =
          (right.recent_signal_score ?? 0) - (left.recent_signal_score ?? 0);
        if (scoreDelta !== 0) return scoreDelta;

        const releaseDelta = toTimestamp(right.release_date ?? right.created_at) -
          toTimestamp(left.release_date ?? left.created_at);
        if (releaseDelta !== 0) return releaseDelta;

        return Number(right.quality_score ?? 0) - Number(left.quality_score ?? 0);
      }
    ).slice(0, Math.min(limit, 8));

    const trending = rankByOrderedFamilySelection(
      (data ?? []).map((model) => ({
        ...model,
        recent_signal_score: recentSignalScores.get(model.id) ?? 0,
      })),
      (left, right) =>
        computeTrendingDiscoveryScore({
          ...right,
          recent_signal_score: recentSignalScores.get(right.id) ?? 0,
        }) -
        computeTrendingDiscoveryScore({
          ...left,
          recent_signal_score: recentSignalScores.get(left.id) ?? 0,
        })
    ).slice(0, limit);

    const discussedUnique = dedupePublicModelFamilies(discussed);
    const combinedModels = dedupePublicModelFamilies([
      ...trending,
      ...popular,
      ...recent,
      ...discussedUnique,
    ]);

    const modelSignals = pickBestModelSignals(combinedModels, recentNewsItems);
    const deployableNewsItems = recentNewsItems.filter((item) => {
        const signalType = getNewsSignalType(item);
        return (
          (signalType === "api" || signalType === "open_source") &&
          (item.source === "provider-deployment-signals" || item.source === "ollama-library")
        );
      });
    const deployableSignals = buildDirectModelSignals(deployableNewsItems);
    const deployable = rankByOrderedFamilySelection(
      (data ?? [])
      .filter((model) => deployableSignals.has(model.id))
      .sort((left, right) => {
        const leftSignal = deployableSignals.get(left.id);
        const rightSignal = deployableSignals.get(right.id);
        const publishedDelta =
          toTimestamp(rightSignal?.publishedAt) - toTimestamp(leftSignal?.publishedAt);
        if (publishedDelta !== 0) return publishedDelta;

        const rightOpenSource = rightSignal?.signalType === "open_source" ? 1 : 0;
        const leftOpenSource = leftSignal?.signalType === "open_source" ? 1 : 0;
        if (rightOpenSource !== leftOpenSource) return rightOpenSource - leftOpenSource;

        const qualityDelta = Number(right.quality_score ?? 0) - Number(left.quality_score ?? 0);
        if (qualityDelta !== 0) return qualityDelta;

        return Number(right.popularity_score ?? 0) - Number(left.popularity_score ?? 0);
      })
      ,
      (left, right) => {
        const leftSignal = deployableSignals.get(left.id);
        const rightSignal = deployableSignals.get(right.id);
        const publishedDelta =
          toTimestamp(rightSignal?.publishedAt) - toTimestamp(leftSignal?.publishedAt);
        if (publishedDelta !== 0) return publishedDelta;

        const rightOpenSource = rightSignal?.signalType === "open_source" ? 1 : 0;
        const leftOpenSource = leftSignal?.signalType === "open_source" ? 1 : 0;
        if (rightOpenSource !== leftOpenSource) return rightOpenSource - leftOpenSource;

        return Number(right.quality_score ?? 0) - Number(left.quality_score ?? 0);
      }
    ).slice(0, limit);

    const attachSignal = <T extends { id: string; provider?: string | null }>(
      modelsWithScores: T[],
      signals = modelSignals
    ) =>
      modelsWithScores.map((model) => ({
        ...model,
        provider:
          typeof model.provider === "string"
            ? getCanonicalProviderName(model.provider)
            : model.provider ?? null,
        recent_signal: signals.get(model.id) ?? null,
      }));

    return NextResponse.json({
      trending: attachSignal(trending),
      recent: attachSignal(recent),
      deployable: attachSignal(deployable, deployableSignals),
      popular: attachSignal(popular),
      discussed: attachSignal(discussedUnique.slice(0, limit)),
    });
  } catch (err) {
    return handleApiError(err, "api/trending");
  }
}
