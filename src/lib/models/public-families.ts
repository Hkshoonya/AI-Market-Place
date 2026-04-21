import {
  buildModelAliasIndex,
  resolveAliasFamilyModelIds,
} from "@/lib/data-sources/model-alias-resolver";
import {
  getCanonicalProviderName,
  getProviderSlug,
  normalizeProviderKey,
} from "@/lib/constants/providers";
import {
  hasLeadershipUpgradeLanguage,
  hasLifecycleWarningLanguage,
  releaseAgeDays,
} from "@/lib/models/public-ranking-confidence";

export interface PublicModelFamilyCandidate {
  id: string;
  slug: string;
  name: string;
  provider: string;
  category?: string | null;
  status?: string | null;
  description?: string | null;
  short_description?: string | null;
  is_api_available?: boolean | null;
  overall_rank?: number | null;
  quality_score?: number | null;
  capability_score?: number | null;
  popularity_score?: number | null;
  adoption_score?: number | null;
  economic_footprint_score?: number | null;
  hf_downloads?: number | null;
  hf_likes?: number | null;
  hf_trending_score?: number | null;
  release_date?: string | null;
  context_window?: number | null;
  is_open_weights?: boolean | null;
  license?: string | null;
  license_name?: string | null;
}

export interface PublicModelFamily<T extends PublicModelFamilyCandidate> {
  familyKey: string;
  representative: T;
  variants: T[];
  variantCount: number;
}

function isGeneralPurposeCategory(category: string | null | undefined) {
  return category === "llm" || category === "multimodal";
}

const DATED_SLUG_RE = /-\d{4}-\d{2}-\d{2}$/;
const COMPACT_SNAPSHOT_SUFFIX_RE = /-(?:20\d{6}|0\d{3})(?=-|$)/g;
const SAFE_VARIANT_RE =
  /\b(exacto|extended|preview|older|audio-preview|realtime-preview)\b/i;
const MACHINE_SNAPSHOT_RE =
  /(?:^|-)(?:generate|transcribe|embed|embedding|tts|speech|image|video)-\d{3}(?:$|-)/i;
const ENDPOINT_ALIAS_PREFIX_RE = /^(chat|reasoner|coder|assistant)(?:-|$)/i;
const PROVIDER_ALIAS_SLUGS: Partial<Record<string, string[]>> = {
  DeepSeek: ["deepseek-ai"],
  Meta: ["meta-ai", "meta-llama", "facebook"],
  MiniMax: ["minimaxai"],
  "Z.ai": ["z-ai", "zai-org", "zai-org-cn", "zaiai"],
  xAI: ["x-ai", "xai"],
};
const MODEL_FAMILY_PREFIX_REPLACEMENTS: Array<[RegExp, string]> = [
  [/^meta-llama-/i, "llama-"],
  [/^nvidia-nemotron-/i, "nemotron-"],
  [/^deepseek-ai-/i, "deepseek-"],
];
const NON_PROVIDER_PREFIX_ALIAS_SLUGS = new Set(["meta-llama"]);

function getProviderSlugCandidates(provider: string) {
  const canonicalProvider = getCanonicalProviderName(provider);
  const providerSlug = provider
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const canonicalProviderSlug = getProviderSlug(canonicalProvider);
  const aliasSlugs = PROVIDER_ALIAS_SLUGS[canonicalProvider] ?? [];

  return [...new Set([providerSlug, canonicalProviderSlug, ...aliasSlugs].filter(Boolean))]
    .sort((left, right) => right.length - left.length);
}

function stripProviderPrefix(slug: string, provider: string) {
  let remaining = slug;
  let changed = true;
  const stripCandidates = getProviderSlugCandidates(provider).filter(
    (candidate) => !NON_PROVIDER_PREFIX_ALIAS_SLUGS.has(candidate)
  );

  while (changed) {
    changed = false;

    for (const providerSlug of stripCandidates) {
      if (remaining.startsWith(`${providerSlug}-`)) {
        remaining = remaining.slice(providerSlug.length + 1);
        changed = true;
      }
    }
  }

  return remaining;
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

function stripProviderNamePrefix(name: string, provider: string) {
  let normalized = name.trim();
  const candidates = [
    provider.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
    getCanonicalProviderName(provider).toLowerCase(),
  ];

  let changed = true;
  while (changed && normalized.length > 0) {
    changed = false;
    const lowered = normalized.toLowerCase();

    for (const candidate of candidates) {
      if (!candidate) continue;
      if (
        lowered === candidate ||
        lowered.startsWith(`${candidate} `) ||
        lowered.startsWith(`${candidate}-`)
      ) {
        normalized = normalized.slice(candidate.length).replace(/^[\s-]+/, "");
        changed = true;
        break;
      }
    }
  }

  return normalized;
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
  const normalizedDisplayName = displayNameToSeriesKey(
    stripProviderNamePrefix(model.name, model.provider)
  );

  if (
    normalizedDisplayName &&
    (!normalizedProviderlessSlug ||
      ENDPOINT_ALIAS_PREFIX_RE.test(normalizedProviderlessSlug) ||
      normalizedProviderlessSlug.endsWith(`-${normalizedDisplayName}`))
  ) {
    return normalizedDisplayName;
  }

  if (normalizedProviderlessSlug) return normalizedProviderlessSlug;

  return normalizedDisplayName;
}

function providerlessSlugToSeriesKey(providerlessSlug: string) {
  const slugKey = normalizeFamilyKey(
    providerlessSlug
      .replace(/^meta-meta-llama-/i, "llama-")
      .replace(DATED_SLUG_RE, "")
      .replace(COMPACT_SNAPSHOT_SUFFIX_RE, "")
      .replace(/-v\d+$/i, "")
      .replace(/-v(\d+)-0(?=-|$)/g, "-v$1")
      .replace(
        /^((?:meta-llama|nvidia-nemotron|deepseek-ai)-)/i,
        (match) =>
          MODEL_FAMILY_PREFIX_REPLACEMENTS.find(([pattern]) =>
            pattern.test(match)
          )?.[1] ?? match
      )
      .replace(/-(?:e|a)?\d+b(?=-|$)/g, "")
      .replace(/-litert-lm(?=-|$)/g, "")
      .replace(
        /-(?:it|instruct|preview|beta|exacto|extended|older|gguf|fp8|bf16|int4|int8|nvfp4|awq|highspeed|fastest|multi-agent|multiagent)(?=-|$)/g,
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
      .replace(/\bmeta[-\s]?llama\b/gi, "llama")
      .replace(/\b(20\d{6}|0\d{3})\b/gi, " ")
      .replace(/\sv\d+$/i, " ")
      .replace(/\bv(\d+)\s+0\b/gi, "v$1 ")
      .replace(/\b(?:e|a)?\d+b\b/gi, " ")
      .replace(/\blitert[-\s]?lm\b/gi, " ")
      .replace(
        /\b(?:it|instruct|preview|beta|exacto|extended|older|gguf|fp8|bf16|int4|int8|nvfp4|awq|highspeed|fastest|multi-agent|multiagent)\b/gi,
        " "
      )
  );
}

function getVariantPenalty<T extends PublicModelFamilyCandidate>(model: T) {
  const slug = model.slug.toLowerCase();
  const name = model.name.toLowerCase();
  let penalty = 0;

  if (DATED_SLUG_RE.test(slug)) penalty += 40;
  if (COMPACT_SNAPSHOT_SUFFIX_RE.test(slug)) penalty += 28;
  if (/\b0\d{3}\b/.test(name)) penalty += 18;
  if (/-v\d+$/.test(slug) || /\sv\d+$/.test(name)) penalty += 20;
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
  if (model.is_open_weights) score += 28;
  else if (model.is_api_available === true) score += 20;
  else if (model.is_api_available === false) score -= 36;

  const providerlessSlug = stripProviderPrefix(model.slug, model.provider);
  if (hasCanonicalProviderPrefix(model)) score += 220;
  if (!DATED_SLUG_RE.test(model.slug)) score += 12;
  if (normalizeFamilyKey(providerlessSlug) === normalizeFamilyKey(model.name)) score += 10;
  if (!SAFE_VARIANT_RE.test(model.slug) && !SAFE_VARIANT_RE.test(model.name)) score += 8;

  return score;
}

function compareRepresentatives<T extends PublicModelFamilyCandidate>(left: T, right: T) {
  const leftLifecycle = hasLifecycleWarningLanguage(left) || left.status === "deprecated";
  const rightLifecycle = hasLifecycleWarningLanguage(right) || right.status === "deprecated";
  const leftAge = releaseAgeDays(left.release_date);
  const rightAge = releaseAgeDays(right.release_date);
  const leftGeneralPurpose = isGeneralPurposeCategory(left.category);
  const rightGeneralPurpose = isGeneralPurposeCategory(right.category);
  const leftRecentLeadership =
    !leftLifecycle &&
    hasLeadershipUpgradeLanguage(left) &&
    leftAge != null &&
    leftAge <= 180;
  const rightRecentLeadership =
    !rightLifecycle &&
    hasLeadershipUpgradeLanguage(right) &&
    rightAge != null &&
    rightAge <= 180;

  if (leftLifecycle !== rightLifecycle) {
    if (!leftLifecycle && rightLifecycle) {
      if ((leftAge ?? Number.POSITIVE_INFINITY) < (rightAge ?? Number.POSITIVE_INFINITY)) {
        return -1;
      }
    }

    if (leftLifecycle && !rightLifecycle) {
      if ((rightAge ?? Number.POSITIVE_INFINITY) < (leftAge ?? Number.POSITIVE_INFINITY)) {
        return 1;
      }
    }
  }

  if (leftRecentLeadership !== rightRecentLeadership) {
    return leftRecentLeadership ? -1 : 1;
  }

  if (leftGeneralPurpose !== rightGeneralPurpose) {
    return leftGeneralPurpose ? -1 : 1;
  }

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

  const seriesSignatureGroups = new Map<string, string[]>();
  for (const model of models) {
    const seriesKey = getPublicSurfaceSeriesKey(model);
    if (!seriesKey) continue;

    const signature = [
      normalizeProviderKey(getCanonicalProviderName(model.provider)),
      seriesKey,
    ].join("||");
    const existing = seriesSignatureGroups.get(signature) ?? [];
    existing.push(model.id);
    seriesSignatureGroups.set(signature, existing);
  }

  for (const ids of seriesSignatureGroups.values()) {
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
