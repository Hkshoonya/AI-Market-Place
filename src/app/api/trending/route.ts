import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";
import {
  computeRecentReleaseDiscoveryScore,
  computePopularDiscoveryScore,
  computeTrendingDiscoveryScore,
  isHighSignalRecentCandidate,
  sortRecentReleaseCandidates,
  sortByDiscoveryScore,
} from "@/lib/models/discovery";
import { preferDefaultPublicSurfaceReady } from "@/lib/models/public-surface-readiness";
import {
  collapsePublicModelFamilies,
  dedupePublicModelFamilies,
  getPublicSurfaceSeriesKey,
} from "@/lib/models/public-families";
import { buildModelNewsEvidenceMap } from "@/lib/news/evidence";
import { pickBestModelSignals } from "@/lib/news/model-signals";
import {
  getNewsSignalImportance,
  getNewsSignalType,
} from "@/lib/news/presentation";
import { getCanonicalProviderName, getProviderBrand } from "@/lib/constants/providers";
import {
  buildDirectDeploymentSignals,
  compareDeploymentSignalSummaries,
  isHighSignalDeploymentCandidate,
  isSurfaceableDeploymentSignal,
  limitProviderBurst,
  normalizeDeploymentSignalSummary,
} from "@/lib/homepage/deployments";

export const dynamic = "force-dynamic";

function toTimestamp(value: string | null | undefined) {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function limitRecentSeriesDuplicates<
  T extends {
    slug: string;
    name: string;
    provider: string;
    quality_score?: number | null;
  }
>(models: T[], limit: number) {
  const selected: T[] = [];
  const selectedIndexBySeries = new Map<string, number>();

  for (const model of models) {
    const seriesKey = getPublicSurfaceSeriesKey(model);
    const existingIndex = selectedIndexBySeries.get(seriesKey);
    if (existingIndex == null) {
      selectedIndexBySeries.set(seriesKey, selected.length);
      selected.push(model);
      if (selected.length >= limit) break;
      continue;
    }

    const existing = selected[existingIndex];
    if (!existing) continue;

    const existingTrustedProvider = getProviderBrand(existing.provider ?? "") ? 1 : 0;
    const nextTrustedProvider = getProviderBrand(model.provider ?? "") ? 1 : 0;

    if (
      nextTrustedProvider > existingTrustedProvider ||
      (nextTrustedProvider === existingTrustedProvider &&
        Number(model.quality_score ?? 0) > Number(existing.quality_score ?? 0))
    ) {
      selected[existingIndex] = model;
    }

    if (selected.length >= limit) break;
  }

  return selected.slice(0, limit);
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

function getRecentDisplayPenalty(model: { slug: string; name: string }) {
  const slug = model.slug.toLowerCase();
  const name = model.name.toLowerCase();
  let penalty = 0;

  if (/(^|-)preview($|-)|\bpreview\b/.test(slug) || /\bpreview\b/.test(name)) penalty += 40;
  if (/(^|-)beta($|-)|\bbeta\b/.test(slug) || /\bbeta\b/.test(name)) penalty += 35;
  if (
    /(^|-)(?:gguf|fp8|bf16|int4|int8|nvfp4|awq|highspeed|fastest)($|-)/.test(slug) ||
    /\b(?:gguf|fp8|bf16|int4|int8|nvfp4|awq|highspeed|fastest)\b/.test(name)
  ) {
    penalty += 30;
  }
  if (/(?:^|-)(?:generate|transcribe|embed|embedding|tts|speech|image|video)-\d{3}(?:$|-)/.test(slug)) {
    penalty += 60;
  }

  return penalty;
}

function mapRecentCandidatesToCanonicalFamilyRepresentatives<
  T extends {
    id: string;
    slug: string;
    name: string;
    provider: string;
    quality_score?: number | null;
    release_date?: string | null;
    created_at?: string | null;
    recent_signal_score?: number | null;
  }
>(models: T[], allModels: T[]) {
  const representativeByVariantId = new Map<string, T>();

  const groupedBySeries = new Map<string, T[]>();
  for (const model of allModels) {
    const key = getPublicSurfaceSeriesKey(model);
    const existing = groupedBySeries.get(key) ?? [];
    existing.push(model);
    groupedBySeries.set(key, existing);
  }

  for (const variants of groupedBySeries.values()) {
    const displayRepresentative =
      [...variants].sort((left, right) => {
        const penaltyDelta = getRecentDisplayPenalty(left) - getRecentDisplayPenalty(right);
        if (penaltyDelta !== 0) return penaltyDelta;

        const qualityDelta = Number(right.quality_score ?? 0) - Number(left.quality_score ?? 0);
        if (qualityDelta !== 0) return qualityDelta;

        return left.slug.length - right.slug.length;
      })[0] ?? variants[0];

    for (const variant of variants) {
      representativeByVariantId.set(variant.id, displayRepresentative);
    }
  }

  return models.map((model) => {
    const representative = representativeByVariantId.get(model.id);
    if (!representative || representative.id === model.id) return model;

    return {
      ...representative,
      release_date: model.release_date ?? representative.release_date ?? null,
      created_at: model.created_at ?? representative.created_at ?? null,
      recent_signal_score: model.recent_signal_score ?? 0,
    };
  });
}

function rewriteRecentRailToCanonicalDisplay<
  T extends {
    id: string;
    slug: string;
    name: string;
    provider: string;
    quality_score?: number | null;
    recent_signal_score?: number | null;
    release_date?: string | null;
    created_at?: string | null;
  }
>(selected: T[], allModels: T[]) {
  const displayRepresentativeBySeries = new Map<string, T>();

  for (const model of allModels) {
    const seriesKey = getPublicSurfaceSeriesKey(model);
    const existing = displayRepresentativeBySeries.get(seriesKey);
    if (!existing) {
      displayRepresentativeBySeries.set(seriesKey, model);
      continue;
    }

    const penaltyDelta = getRecentDisplayPenalty(model) - getRecentDisplayPenalty(existing);
    if (penaltyDelta < 0) {
      displayRepresentativeBySeries.set(seriesKey, model);
      continue;
    }
    if (penaltyDelta > 0) continue;

    const qualityDelta = Number(model.quality_score ?? 0) - Number(existing.quality_score ?? 0);
    if (qualityDelta > 0) {
      displayRepresentativeBySeries.set(seriesKey, model);
      continue;
    }
    if (qualityDelta < 0) continue;

    if (model.slug.length < existing.slug.length) {
      displayRepresentativeBySeries.set(seriesKey, model);
    }
  }

  return dedupePublicModelFamilies(
    selected.map((model) => {
      const representative = displayRepresentativeBySeries.get(getPublicSurfaceSeriesKey(model));
      if (!representative || representative.id === model.id) return model;

      return {
        ...representative,
        recent_signal_score: model.recent_signal_score ?? 0,
        release_date: model.release_date ?? representative.release_date ?? null,
        created_at: model.created_at ?? representative.created_at ?? null,
      };
    })
  );
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
  if (signalType !== "launch") {
    return 0;
  }

  const importance = getNewsSignalImportance(item);
  const ageHours = Math.max(0, (Date.now() - toTimestamp(item.published_at)) / 3_600_000);
  const recencyScore = Math.max(0, 72 - Math.min(ageHours, 72));
  const importanceScore = importance === "high" ? 3 : importance === "medium" ? 2 : 1;
  const typeScore = 3;

  return recencyScore + importanceScore * 12 + typeScore * 10;
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
    const visibleModels = dedupePublicModelFamilies(
      preferDefaultPublicSurfaceReady(data ?? [], 8)
    );

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

    const recentCandidates = visibleModels
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

    const allModelsWithRecentSignals = visibleModels.map((model) => ({
      ...model,
      recent_signal_score: recentSignalScores.get(model.id) ?? 0,
    }));

    const recentDisplayCandidates = mapRecentCandidatesToCanonicalFamilyRepresentatives(
      recentCandidates,
      allModelsWithRecentSignals
    );

    const recent = rewriteRecentRailToCanonicalDisplay(
      limitRecentSeriesDuplicates(
      rankByOrderedFamilySelection(
        sortRecentReleaseCandidates(recentDisplayCandidates),
        (left, right) => {
          const scoreDelta =
            computeRecentReleaseDiscoveryScore(right) -
            computeRecentReleaseDiscoveryScore(left);
          if (scoreDelta !== 0) return scoreDelta;

          const releaseDelta = toTimestamp(right.release_date ?? right.created_at) -
            toTimestamp(left.release_date ?? left.created_at);
          if (releaseDelta !== 0) return releaseDelta;

          return Number(right.quality_score ?? 0) - Number(left.quality_score ?? 0);
        }
      ),
      Math.min(limit, 8)
      ),
      allModelsWithRecentSignals
    );

    const trending = rankByOrderedFamilySelection(
      visibleModels.map((model) => ({
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
    const launchOnlySignals = pickBestModelSignals(
      combinedModels,
      recentNewsItems.filter((item) => getNewsSignalType(item) === "launch")
    );
    const deployableNewsItems = recentNewsItems.filter(isSurfaceableDeploymentSignal);
    const deployableSignals = buildDirectDeploymentSignals(deployableNewsItems);
    const deployable = limitProviderBurst(
      limitRecentSeriesDuplicates(
      rankByOrderedFamilySelection(
        visibleModels
          .filter((model) => deployableSignals.has(model.id))
          .filter((model) => isHighSignalDeploymentCandidate(model))
          .sort((left, right) => {
            const rightTrustedProvider = getProviderBrand(right.provider ?? "") ? 1 : 0;
            const leftTrustedProvider = getProviderBrand(left.provider ?? "") ? 1 : 0;
            if (rightTrustedProvider !== leftTrustedProvider) {
              return rightTrustedProvider - leftTrustedProvider;
            }

            const leftSignal = deployableSignals.get(left.id);
            const rightSignal = deployableSignals.get(right.id);
            if (leftSignal && rightSignal) {
              const signalDelta = compareDeploymentSignalSummaries(leftSignal, rightSignal);
              if (signalDelta !== 0) return signalDelta;
            }

            const qualityDelta = Number(right.quality_score ?? 0) - Number(left.quality_score ?? 0);
            if (qualityDelta !== 0) return qualityDelta;

            return Number(right.popularity_score ?? 0) - Number(left.popularity_score ?? 0);
          }),
        (left, right) => {
          const rightTrustedProvider = getProviderBrand(right.provider ?? "") ? 1 : 0;
          const leftTrustedProvider = getProviderBrand(left.provider ?? "") ? 1 : 0;
          if (rightTrustedProvider !== leftTrustedProvider) {
            return rightTrustedProvider - leftTrustedProvider;
          }

          const leftSignal = deployableSignals.get(left.id);
          const rightSignal = deployableSignals.get(right.id);
          if (leftSignal && rightSignal) {
            const signalDelta = compareDeploymentSignalSummaries(leftSignal, rightSignal);
            if (signalDelta !== 0) return signalDelta;
          }

          return Number(right.quality_score ?? 0) - Number(left.quality_score ?? 0);
        }
      ),
      limit
      ),
      limit
    );

    const attachSignal = <T extends { id: string; slug: string; name: string; provider: string }>(
      modelsWithScores: T[],
      signals = modelSignals
    ) =>
      modelsWithScores.map((model) => ({
        ...model,
        provider:
          typeof model.provider === "string"
            ? getCanonicalProviderName(model.provider)
            : model.provider ?? null,
        recent_signal:
          signals === deployableSignals
            ? (() => {
                const signal = deployableSignals.get(model.id);
                return signal ? normalizeDeploymentSignalSummary(model, signal) : null;
              })()
            : signals.get(model.id) ?? null,
      }));

    return NextResponse.json({
      trending: attachSignal(trending),
      recent: attachSignal(recent, launchOnlySignals),
      deployable: attachSignal(deployable, deployableSignals),
      popular: attachSignal(popular),
      discussed: attachSignal(discussedUnique.slice(0, limit)),
    });
  } catch (err) {
    return handleApiError(err, "api/trending");
  }
}
