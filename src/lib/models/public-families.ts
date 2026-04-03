import {
  buildModelAliasIndex,
  resolveAliasFamilyModelIds,
} from "@/lib/data-sources/model-alias-resolver";
import { getProviderSlug } from "@/lib/constants/providers";

export interface PublicModelFamilyCandidate {
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

export interface PublicModelFamily<T extends PublicModelFamilyCandidate> {
  familyKey: string;
  representative: T;
  variants: T[];
  variantCount: number;
}

const DATED_SLUG_RE = /-\d{4}-\d{2}-\d{2}$/;
const SAFE_VARIANT_RE =
  /\b(exacto|extended|preview|older|audio-preview|realtime-preview)\b/i;
const MACHINE_SNAPSHOT_RE =
  /(?:^|-)(?:generate|transcribe|embed|embedding|tts|speech|image|video)-\d{3}(?:$|-)/i;

function stripProviderPrefix(slug: string, provider: string) {
  const providerSlug = provider
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (providerSlug && slug.startsWith(`${providerSlug}-`)) {
    return slug.slice(providerSlug.length + 1);
  }

  return slug;
}

function normalizeFamilyKey(value: string) {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeDisplayKey(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[-_.:/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getFamilyKey<T extends PublicModelFamilyCandidate>(model: T) {
  const providerlessSlug = stripProviderPrefix(model.slug, model.provider);
  const baseSlug = providerlessSlug.replace(DATED_SLUG_RE, "");
  return normalizeFamilyKey(baseSlug || model.name || model.slug);
}

export function getPublicSurfaceSeriesKey<
  T extends Pick<PublicModelFamilyCandidate, "slug" | "name" | "provider">
>(model: T) {
  const normalizedProviderlessSlug = providerlessSlugToSeriesKey(
    stripProviderPrefix(model.slug, model.provider)
  );
  if (normalizedProviderlessSlug) return normalizedProviderlessSlug;

  return displayNameToSeriesKey(model.name);
}

function providerlessSlugToSeriesKey(providerlessSlug: string) {
  const slugKey = normalizeFamilyKey(
    providerlessSlug
      .replace(DATED_SLUG_RE, "")
      .replace(/-v(\d+)-0(?=-|$)/g, "-v$1")
      .replace(/-(?:e|a)?\d+b(?=-|$)/g, "")
      .replace(
        /-(?:it|instruct|preview|exacto|extended|older|gguf|fp8|bf16|int4|int8|nvfp4|awq|highspeed|fastest|multi-agent|multiagent)(?=-|$)/g,
        ""
      )
      .replace(/-+/g, "-")
  );

  return slugKey;
}

function displayNameToSeriesKey(name: string) {
  return normalizeFamilyKey(
    name
      .replace(/\([^)]*\)/g, " ")
      .replace(/\bv(\d+)\s+0\b/gi, "v$1 ")
      .replace(/\b(?:e|a)?\d+b\b/gi, " ")
      .replace(
        /\b(?:it|instruct|preview|exacto|extended|older|gguf|fp8|bf16|int4|int8|nvfp4|awq|highspeed|fastest|multi-agent|multiagent)\b/gi,
        " "
      )
  );
}

function getVariantPenalty<T extends PublicModelFamilyCandidate>(model: T) {
  const slug = model.slug.toLowerCase();
  const name = model.name.toLowerCase();
  let penalty = 0;

  if (DATED_SLUG_RE.test(slug)) penalty += 40;
  if (SAFE_VARIANT_RE.test(slug) || SAFE_VARIANT_RE.test(name)) penalty += 35;
  if (MACHINE_SNAPSHOT_RE.test(slug)) penalty += 55;
  if (/(^|-)it($|-)/.test(slug)) penalty += 12;
  if (/\bolder\b/.test(name)) penalty += 25;
  if ((model.quality_score ?? 0) <= 0) penalty += 18;
  if ((model.hf_downloads ?? 0) <= 0) penalty += 10;

  return penalty;
}

function hasCanonicalProviderPrefix<T extends PublicModelFamilyCandidate>(model: T) {
  const canonicalProviderSlug = getProviderSlug(model.provider);
  return Boolean(canonicalProviderSlug) && model.slug.startsWith(`${canonicalProviderSlug}-`);
}

function getRepresentativeScore<T extends PublicModelFamilyCandidate>(model: T) {
  const quality = Number(model.quality_score ?? 0);
  const capability = Number(model.capability_score ?? 0);
  const popularity = Number(model.popularity_score ?? 0);
  const adoption = Number(model.adoption_score ?? 0);
  const economic = Number(model.economic_footprint_score ?? 0);
  const downloads = Number(model.hf_downloads ?? 0);
  const rank = Number(model.overall_rank ?? 9_999);

  let score = 0;
  score += quality * 14;
  score += capability * 10;
  score += popularity * 6;
  score += adoption * 8;
  score += economic * 8;
  score += Math.max(0, 1_000 - rank) / 4;
  score += downloads > 0 ? Math.log10(downloads + 1) * 18 : 0;
  score -= getVariantPenalty(model);

  const providerlessSlug = stripProviderPrefix(model.slug, model.provider);
  if (hasCanonicalProviderPrefix(model)) score += 220;
  if (!DATED_SLUG_RE.test(model.slug)) score += 12;
  if (normalizeFamilyKey(providerlessSlug) === normalizeFamilyKey(model.name)) score += 10;
  if (!SAFE_VARIANT_RE.test(model.slug) && !SAFE_VARIANT_RE.test(model.name)) score += 8;

  return score;
}

function compareRepresentatives<T extends PublicModelFamilyCandidate>(left: T, right: T) {
  const scoreDiff = getRepresentativeScore(right) - getRepresentativeScore(left);
  if (scoreDiff !== 0) return scoreDiff;

  const penaltyDiff = getVariantPenalty(left) - getVariantPenalty(right);
  if (penaltyDiff !== 0) return penaltyDiff;

  const qualityDiff = Number(right.quality_score ?? 0) - Number(left.quality_score ?? 0);
  if (qualityDiff !== 0) return qualityDiff;

  const downloadDiff = Number(right.hf_downloads ?? 0) - Number(left.hf_downloads ?? 0);
  if (downloadDiff !== 0) return downloadDiff;

  const rankDiff = Number(left.overall_rank ?? 9_999) - Number(right.overall_rank ?? 9_999);
  if (rankDiff !== 0) return rankDiff;

  const slugLengthDiff = left.slug.length - right.slug.length;
  if (slugLengthDiff !== 0) return slugLengthDiff;

  return left.slug.localeCompare(right.slug);
}

export function collapsePublicModelFamilies<T extends PublicModelFamilyCandidate>(
  models: T[]
): Array<PublicModelFamily<T>> {
  const byId = new Map(models.map((model) => [model.id, model]));
  const index = buildModelAliasIndex(
    models.map((model) => ({
      id: model.id,
      slug: model.slug,
      name: model.name,
      provider: model.provider,
    }))
  );
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    const currentParent = parent.get(id) ?? id;
    if (currentParent === id) return id;
    const root = find(currentParent);
    parent.set(id, root);
    return root;
  };
  const union = (leftId: string, rightId: string) => {
    const leftRoot = find(leftId);
    const rightRoot = find(rightId);
    if (leftRoot !== rightRoot) {
      parent.set(rightRoot, leftRoot);
    }
  };

  for (const model of models) {
    parent.set(model.id, model.id);
  }

  for (const model of models) {
    const familyIds = resolveAliasFamilyModelIds(index, {
      slugCandidates: [model.slug],
      nameCandidates: [model.name],
    }).filter((id) => byId.has(id));

    if (familyIds.length < 2) continue;

    const [anchorId, ...rest] = familyIds;
    for (const familyId of rest) {
      union(anchorId, familyId);
    }
  }

  const exactSignatureGroups = new Map<string, string[]>();
  for (const model of models) {
    const signature = [
      normalizeDisplayKey(model.name),
      normalizeDisplayKey(model.provider),
      normalizeDisplayKey(model.category),
    ].join("||");
    const existing = exactSignatureGroups.get(signature) ?? [];
    existing.push(model.id);
    exactSignatureGroups.set(signature, existing);
  }

  for (const ids of exactSignatureGroups.values()) {
    if (ids.length < 2) continue;
    const [anchorId, ...rest] = ids;
    for (const id of rest) {
      union(anchorId, id);
    }
  }

  const grouped = new Map<string, T[]>();
  for (const model of models) {
    const rootId = find(model.id);
    const existing = grouped.get(rootId) ?? [];
    existing.push(model);
    grouped.set(rootId, existing);
  }

  const families: Array<PublicModelFamily<T>> = [];

  for (const variantsRaw of grouped.values()) {
    const variants = [...variantsRaw].sort(compareRepresentatives);
    const representative = variants[0];
    if (!representative) continue;

    families.push({
      familyKey: getFamilyKey(representative),
      representative,
      variants,
      variantCount: variants.length,
    });
  }

  return families.sort((left, right) =>
    compareRepresentatives(left.representative, right.representative)
  );
}

export function dedupePublicModelFamilies<T extends PublicModelFamilyCandidate>(models: T[]) {
  return collapsePublicModelFamilies(models).map((family) => family.representative);
}
