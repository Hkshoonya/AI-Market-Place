import { collapsePublicModelFamilies } from "@/lib/models/public-families";
import { preferDefaultPublicSurfaceReady } from "@/lib/models/public-surface-readiness";
import { getCanonicalProviderName } from "@/lib/constants/providers";

export interface HomepageTopModelCandidate {
  id: string;
  slug?: string | null;
  name?: string | null;
  provider?: string | null;
  category?: string | null;
  short_description?: string | null;
  description?: string | null;
  overall_rank?: number | null;
  capability_score?: number | null;
  adoption_score?: number | null;
  economic_footprint_score?: number | null;
  quality_score?: number | null;
  popularity_score?: number | null;
  release_date?: string | null;
  is_open_weights?: boolean | null;
  license?: string | null;
  license_name?: string | null;
  context_window?: number | null;
  hf_downloads?: number | null;
  hf_likes?: number | null;
  hf_trending_score?: number | null;
}

const PRIMARY_HOMEPAGE_CATEGORIES = new Set(["llm", "multimodal"]);

function numeric(value: number | null | undefined): number {
  return value == null || !Number.isFinite(Number(value)) ? 0 : Number(value);
}

function normalizeProviderBucket(provider: string | null | undefined): string | null {
  if (!provider) return null;

  const canonical = getCanonicalProviderName(provider).trim();
  if (!canonical) return null;

  return canonical.toLowerCase();
}

function rankSignal(overallRank: number | null | undefined): number {
  if (overallRank == null || !Number.isFinite(Number(overallRank))) return 0;

  const boundedRank = Math.max(1, Math.min(100, Number(overallRank)));
  return 101 - boundedRank;
}

export function releaseAgeDays(
  releaseDate: string | null | undefined,
  now = Date.now()
): number | null {
  if (!releaseDate) return null;

  const timestamp = Date.parse(releaseDate);
  if (!Number.isFinite(timestamp)) return null;

  return Math.max(0, (now - timestamp) / (24 * 60 * 60 * 1000));
}

function releaseFreshnessSignal(
  releaseDate: string | null | undefined,
  now = Date.now()
): number {
  const ageDays = releaseAgeDays(releaseDate, now);
  if (ageDays == null) return 40;

  if (ageDays <= 60) return 100;
  if (ageDays <= 120) return 92;
  if (ageDays <= 180) return 84;
  if (ageDays <= 270) return 70;
  if (ageDays <= 365) return 52;
  if (ageDays <= 450) return 28;
  return 10;
}

function releaseFreshnessMultiplier(
  releaseDate: string | null | undefined,
  now = Date.now()
): number {
  const ageDays = releaseAgeDays(releaseDate, now);
  if (ageDays == null) return 0.68;

  if (ageDays <= 60) return 1;
  if (ageDays <= 120) return 0.96;
  if (ageDays <= 180) return 0.88;
  if (ageDays <= 270) return 0.72;
  if (ageDays <= 365) return 0.52;
  if (ageDays <= 450) return 0.28;
  return 0.14;
}

export function isPreviewLikeModel(model: HomepageTopModelCandidate): boolean {
  const haystack = `${model.slug ?? ""} ${model.name ?? ""}`.toLowerCase();
  return /\b(preview|beta|experimental|alpha|test)\b/.test(haystack);
}

export function isEfficiencyTierModel(model: HomepageTopModelCandidate): boolean {
  const haystack = `${model.slug ?? ""} ${model.name ?? ""}`.toLowerCase();
  return /\b(flash|mini|nano|instant|lite)\b/.test(haystack);
}

export function hasLifecycleWarningLanguage(model: HomepageTopModelCandidate): boolean {
  const haystack = `${model.short_description ?? ""} ${model.description ?? ""}`.toLowerCase();

  return (
    /\bdeprecated\b/.test(haystack) ||
    /\blegacy\b/.test(haystack) ||
    /\bsuperseded\b/.test(haystack) ||
    /retained for compatibility/.test(haystack) ||
    /recommended replacement/.test(haystack) ||
    /previous full/.test(haystack) ||
    /previous generation/.test(haystack)
  );
}

function hasLeadershipUpgradeLanguage(model: HomepageTopModelCandidate): boolean {
  const haystack = `${model.name ?? ""} ${model.short_description ?? ""} ${
    model.description ?? ""
  }`.toLowerCase();

  return (
    /\blatest\b/.test(haystack) ||
    /next generation/.test(haystack) ||
    /\bflagship\b/.test(haystack) ||
    /\bmost capable\b/.test(haystack) ||
    /\bstate-of-the-art\b/.test(haystack) ||
    /building on/.test(haystack) ||
    /built on/.test(haystack) ||
    /improves on/.test(haystack) ||
    /stronger than prior/.test(haystack) ||
    /broad availability/.test(haystack)
  );
}

function hasRecentLeadershipReadinessSignals(model: HomepageTopModelCandidate): boolean {
  const capability = numeric(model.capability_score);
  const quality = numeric(model.quality_score);
  const adoption = numeric(model.adoption_score);
  const economic = numeric(model.economic_footprint_score);
  const popularity = numeric(model.popularity_score);

  return (
    quality >= 50 ||
    (adoption >= 58 && economic >= 45) ||
    (quality >= 46 && capability >= 62 && adoption >= 52) ||
    (capability >= 62 && economic >= 50) ||
    (capability >= 68 && popularity >= 52)
  );
}

export function isRecentLeadershipHomepageCandidate(
  model: HomepageTopModelCandidate,
  now = Date.now()
): boolean {
  if (!isPrimaryHomepageCategory(model)) return false;
  if (isSpecializedHomepageCandidate(model)) return false;
  if (isPreviewLikeModel(model) || isEfficiencyTierModel(model)) return false;
  if (hasLifecycleWarningLanguage(model)) return false;
  if (!hasLeadershipUpgradeLanguage(model)) return false;

  const ageDays = releaseAgeDays(model.release_date, now);
  if (ageDays == null || ageDays > 120) return false;

  const capability = numeric(model.capability_score);
  const quality = numeric(model.quality_score);

  if (capability < 44 && quality < 44) return false;
  if (!hasRecentLeadershipReadinessSignals(model)) return false;

  return hasMeaningfulHomepageTraction(model);
}

function isSpecializedHomepageCandidate(model: HomepageTopModelCandidate): boolean {
  const category = (model.category ?? "").toLowerCase();
  if (["image_generation", "video_generation", "speech_audio", "embeddings"].includes(category)) {
    return true;
  }

  const haystack = `${model.slug ?? ""} ${model.name ?? ""}`.toLowerCase();
  return /\b(image|transcribe|tts|speech|audio|embedding|embed|ocr)\b/.test(haystack);
}

function isPrimaryHomepageCategory(model: HomepageTopModelCandidate): boolean {
  return PRIMARY_HOMEPAGE_CATEGORIES.has((model.category ?? "").toLowerCase());
}

function hasStrongHomepageCoreScores(model: HomepageTopModelCandidate): boolean {
  const capability = numeric(model.capability_score);
  const quality = numeric(model.quality_score);

  if (
    isRecentLeadershipHomepageCandidate(model) &&
    capability >= 44 &&
    quality >= 44
  ) {
    return true;
  }

  if (capability >= 84 || quality >= 84) return true;
  if (capability >= 80 && quality >= 66) return true;
  if (capability >= 76 && quality >= 58) return true;
  if (capability >= 72 && quality >= 72) return true;

  return false;
}

function hasMeaningfulHomepageTraction(model: HomepageTopModelCandidate): boolean {
  return (
    numeric(model.adoption_score) >= 55 ||
    numeric(model.economic_footprint_score) >= 50 ||
    numeric(model.popularity_score) >= 52 ||
    numeric(model.overall_rank) > 0
  );
}

export function isHighConfidenceHomepageTopModelCandidate(
  model: HomepageTopModelCandidate,
  now = Date.now()
): boolean {
  if (!isPrimaryHomepageCategory(model)) return false;
  if (isSpecializedHomepageCandidate(model)) return false;
  if (hasLifecycleWarningLanguage(model)) return false;
  if (isPreviewLikeModel(model)) return false;
  if (isEfficiencyTierModel(model)) return false;

  return (
    hasStrongHomepageCoreScores(model) || isRecentLeadershipHomepageCandidate(model, now)
  ) && hasMeaningfulHomepageTraction(model);
}

function homepageCandidateMultiplier(
  model: HomepageTopModelCandidate,
  now = Date.now()
): number {
  let multiplier = 1;
  const ageDays = releaseAgeDays(model.release_date, now);

  if (isSpecializedHomepageCandidate(model)) {
    multiplier *= 0.78;
  }

  if (isPreviewLikeModel(model)) {
    multiplier *= 0.88;
  }

  if (isEfficiencyTierModel(model)) {
    multiplier *= ageDays == null || ageDays > 240 ? 0.72 : 0.84;
  }

  if (hasLifecycleWarningLanguage(model)) {
    multiplier *= 0.45;
  }

  if (isRecentLeadershipHomepageCandidate(model, now)) {
    multiplier *= 1.24;
  }

  if (ageDays != null && ageDays > 450) {
    multiplier *= 0.52;
  } else if (ageDays != null && ageDays > 365) {
    multiplier *= 0.72;
  }

  const freshness = releaseFreshnessSignal(model.release_date, now);
  if (freshness < 45) {
    multiplier *= 0.82;
  }

  return multiplier;
}

export function computeHomepageTopModelScore(
  model: HomepageTopModelCandidate,
  now = Date.now()
): number {
  const freshnessMultiplier = releaseFreshnessMultiplier(model.release_date, now);
  const rawScore =
    numeric(model.capability_score) * 0.28 +
    numeric(model.quality_score) * 0.24 +
    numeric(model.adoption_score) * 0.13 * freshnessMultiplier +
    numeric(model.popularity_score) * 0.07 * freshnessMultiplier +
    numeric(model.economic_footprint_score) * 0.07 * freshnessMultiplier +
    rankSignal(model.overall_rank) * 0.03 +
    releaseFreshnessSignal(model.release_date, now) * 0.12;

  return rawScore * homepageCandidateMultiplier(model, now);
}

export function selectHomepageTopModelIds<
  T extends HomepageTopModelCandidate
>(models: T[], limit: number, now = Date.now()): string[] {
  const discoveryPool = preferDefaultPublicSurfaceReady(
    models,
    Math.min(limit, 5)
  );

  const familyCandidates = discoveryPool.filter(
    (
      model
    ): model is T & {
      slug: string;
      name: string;
      provider: string;
    } =>
      typeof model.slug === "string" &&
      model.slug.length > 0 &&
      typeof model.name === "string" &&
      model.name.length > 0 &&
      typeof model.provider === "string" &&
      model.provider.length > 0
  );
  const familyRepresentatives = collapsePublicModelFamilies(familyCandidates).map(
    (family) => family.representative
  );
  const familyCandidateIds = new Set(familyCandidates.map((model) => model.id));
  const uncategorizedCandidates = discoveryPool.filter(
    (model) => !familyCandidateIds.has(model.id)
  );

  const rankedCandidates = [...familyRepresentatives, ...uncategorizedCandidates].filter((model) => {
    return (
      model.economic_footprint_score != null ||
      model.adoption_score != null ||
      model.capability_score != null
    );
  });

  const highConfidenceCandidates = rankedCandidates.filter((model) =>
    isHighConfidenceHomepageTopModelCandidate(model, now)
  );
  const compareCandidates = (left: T, right: T) => {
    const scoreDelta =
      computeHomepageTopModelScore(right, now) - computeHomepageTopModelScore(left, now);
    if (scoreDelta !== 0) return scoreDelta;

    const rankDelta = rankSignal(right.overall_rank) - rankSignal(left.overall_rank);
    if (rankDelta !== 0) return rankDelta;

    return numeric(right.capability_score) - numeric(left.capability_score);
  };
  const prioritizedHighConfidence = [...highConfidenceCandidates].sort(compareCandidates);
  const highConfidenceIds = new Set(prioritizedHighConfidence.map((model) => model.id));
  const prioritizedFallback = rankedCandidates
    .filter((model) => !highConfidenceIds.has(model.id))
    .sort(compareCandidates);
  const selected: T[] = [];
  const selectedIds = new Set<string>();
  const providerCounts = new Map<string, number>();
  const diversityTarget = Math.min(limit, 8);

  for (const model of prioritizedHighConfidence) {
    const providerBucket = normalizeProviderBucket(model.provider);
    const providerCount = providerBucket ? (providerCounts.get(providerBucket) ?? 0) : 0;

    if (selected.length < diversityTarget && providerBucket && providerCount >= 1) {
      continue;
    }

    selected.push(model);
    selectedIds.add(model.id);
    if (providerBucket) {
      providerCounts.set(providerBucket, providerCount + 1);
    }

    if (selected.length >= limit) {
      return selected.map((candidate) => candidate.id);
    }
  }

  const fillUniqueProviders = (candidates: T[]) => {
    for (const model of candidates) {
      if (selectedIds.has(model.id)) continue;
      const providerBucket = normalizeProviderBucket(model.provider);
      if (providerBucket && providerCounts.has(providerBucket)) continue;

      selected.push(model);
      selectedIds.add(model.id);
      if (providerBucket) {
        providerCounts.set(providerBucket, 1);
      }

      if (selected.length >= limit) {
        return true;
      }
    }

    return false;
  };

  if (fillUniqueProviders(prioritizedHighConfidence)) {
    return selected.map((candidate) => candidate.id);
  }

  if (fillUniqueProviders(prioritizedFallback)) {
    return selected.map((candidate) => candidate.id);
  }

  for (const candidates of [prioritizedHighConfidence, prioritizedFallback]) {
    for (const model of candidates) {
      if (selectedIds.has(model.id)) continue;
      selected.push(model);
      selectedIds.add(model.id);
      if (selected.length >= limit) {
        return selected.map((candidate) => candidate.id);
      }
    }
  }

  return selected.map((model) => model.id);
}
