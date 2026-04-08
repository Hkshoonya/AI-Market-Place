import { collapsePublicModelFamilies } from "@/lib/models/public-families";

interface HomepageTopModelCandidate {
  id: string;
  slug?: string | null;
  name?: string | null;
  provider?: string | null;
  category?: string | null;
  overall_rank?: number | null;
  capability_score?: number | null;
  adoption_score?: number | null;
  economic_footprint_score?: number | null;
  quality_score?: number | null;
  popularity_score?: number | null;
  release_date?: string | null;
  hf_downloads?: number | null;
}

function numeric(value: number | null | undefined): number {
  return value == null || !Number.isFinite(Number(value)) ? 0 : Number(value);
}

function rankSignal(overallRank: number | null | undefined): number {
  if (overallRank == null || !Number.isFinite(Number(overallRank))) return 0;

  const boundedRank = Math.max(1, Math.min(100, Number(overallRank)));
  return 101 - boundedRank;
}

function releaseFreshnessSignal(
  releaseDate: string | null | undefined,
  now = Date.now()
): number {
  if (!releaseDate) return 45;

  const timestamp = Date.parse(releaseDate);
  if (!Number.isFinite(timestamp)) return 45;

  const ageDays = Math.max(0, (now - timestamp) / (24 * 60 * 60 * 1000));

  if (ageDays <= 120) return 100;
  if (ageDays <= 240) return 85;
  if (ageDays <= 365) return 70;
  if (ageDays <= 540) return 45;
  return 20;
}

function releaseFreshnessMultiplier(
  releaseDate: string | null | undefined,
  now = Date.now()
): number {
  if (!releaseDate) return 0.9;

  const timestamp = Date.parse(releaseDate);
  if (!Number.isFinite(timestamp)) return 0.9;

  const ageDays = Math.max(0, (now - timestamp) / (24 * 60 * 60 * 1000));

  if (ageDays <= 120) return 1;
  if (ageDays <= 240) return 0.9;
  if (ageDays <= 365) return 0.75;
  if (ageDays <= 540) return 0.56;
  return 0.4;
}

function isPreviewLikeModel(model: HomepageTopModelCandidate): boolean {
  const haystack = `${model.slug ?? ""} ${model.name ?? ""}`.toLowerCase();
  return /\b(preview|beta|experimental|alpha|test)\b/.test(haystack);
}

function isEfficiencyTierModel(model: HomepageTopModelCandidate): boolean {
  const haystack = `${model.slug ?? ""} ${model.name ?? ""}`.toLowerCase();
  return /\b(flash|mini|nano|instant|lite)\b/.test(haystack);
}

function isSpecializedHomepageCandidate(model: HomepageTopModelCandidate): boolean {
  const category = (model.category ?? "").toLowerCase();
  if (["image_generation", "video_generation", "speech_audio", "embeddings"].includes(category)) {
    return true;
  }

  const haystack = `${model.slug ?? ""} ${model.name ?? ""}`.toLowerCase();
  return /\b(image|transcribe|tts|speech|audio|embedding|embed|ocr)\b/.test(haystack);
}

function homepageCandidateMultiplier(
  model: HomepageTopModelCandidate,
  now = Date.now()
): number {
  let multiplier = 1;

  if (isSpecializedHomepageCandidate(model)) {
    multiplier *= 0.78;
  }

  if (isPreviewLikeModel(model)) {
    multiplier *= 0.88;
  }

  if (isEfficiencyTierModel(model)) {
    multiplier *= 0.84;
  }

  const freshness = releaseFreshnessSignal(model.release_date, now);
  if (freshness < 45) {
    multiplier *= 0.92;
  }

  return multiplier;
}

export function computeHomepageTopModelScore(
  model: HomepageTopModelCandidate,
  now = Date.now()
): number {
  const freshnessMultiplier = releaseFreshnessMultiplier(model.release_date, now);
  const rawScore =
    numeric(model.capability_score) * 0.26 +
    numeric(model.quality_score) * 0.22 +
    numeric(model.adoption_score) * 0.17 * freshnessMultiplier +
    numeric(model.popularity_score) * 0.10 * freshnessMultiplier +
    numeric(model.economic_footprint_score) * 0.09 * freshnessMultiplier +
    rankSignal(model.overall_rank) * 0.08 +
    releaseFreshnessSignal(model.release_date, now) * 0.08;

  return rawScore * homepageCandidateMultiplier(model, now);
}

export function selectHomepageTopModelIds<
  T extends HomepageTopModelCandidate
>(models: T[], limit: number, now = Date.now()): string[] {
  const familyCandidates = models.filter(
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
  const uncategorizedCandidates = models.filter((model) => !familyCandidateIds.has(model.id));

  return [...familyRepresentatives, ...uncategorizedCandidates]
    .filter((model) => {
      return (
        model.economic_footprint_score != null ||
        model.adoption_score != null ||
        model.capability_score != null
      );
    })
    .sort((left, right) => {
      const scoreDelta =
        computeHomepageTopModelScore(right, now) - computeHomepageTopModelScore(left, now);
      if (scoreDelta !== 0) return scoreDelta;

      const rankDelta = rankSignal(right.overall_rank) - rankSignal(left.overall_rank);
      if (rankDelta !== 0) return rankDelta;

      return numeric(right.capability_score) - numeric(left.capability_score);
    })
    .slice(0, limit)
    .map((model) => model.id);
}
