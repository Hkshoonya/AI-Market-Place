import { makeSlug } from "./utils";

interface AliasModelRecord {
  id: string;
  slug: string;
  name: string;
  provider: string;
}

interface ResolveAliasFamilyOptions {
  slugCandidates?: Array<string | null | undefined>;
  nameCandidates?: Array<string | null | undefined>;
}

interface ModelAliasIndex {
  models: AliasModelRecord[];
  idToModel: Map<string, AliasModelRecord>;
  slugToIds: Map<string, string[]>;
  nameToIds: Map<string, string[]>;
  baseToDatedIds: Map<string, string[]>;
}

const DATE_SUFFIX_RE = /^(.+)-\d{4}-\d{2}-\d{2}$/;
const SAFE_FAMILY_QUALIFIER_TOKENS = [
  "extended",
  "preview",
  "exacto",
  "image preview",
];

function pushUnique(map: Map<string, string[]>, key: string, value: string) {
  if (!key) return;
  const existing = map.get(key) ?? [];
  if (!existing.includes(value)) {
    existing.push(value);
    map.set(key, existing);
  }
}

function uniqueNormalized(values: Array<string | null | undefined>, normalizer: (value: string) => string) {
  return [...new Set(values.map((value) => normalizer(value ?? "")).filter(Boolean))];
}

function stripDateSuffix(slug: string): string {
  return slug.replace(DATE_SUFFIX_RE, "$1");
}

function stripSafeFamilyQualifiers(value: string) {
  return value.replace(/\(([^)]*)\)/g, (match, qualifier: string) => {
    const lowerQualifier = qualifier.trim().toLowerCase();
    return SAFE_FAMILY_QUALIFIER_TOKENS.some((token) => lowerQualifier.includes(token))
      ? " "
      : match;
  });
}

function normalizeNameKey(value: string) {
  return stripSafeFamilyQualifiers(value)
    .trim()
    .toLowerCase()
    .replace(/[-_.:/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function expandAliasCandidates(aliases: Array<string | null | undefined>) {
  const expanded = new Set<string>();

  for (const alias of aliases) {
    const trimmed = typeof alias === "string" ? alias.trim() : "";
    if (!trimmed) continue;

    expanded.add(trimmed);

    for (const segment of trimmed.split(/[\\/|:]/)) {
      const normalizedSegment = segment.trim();
      if (normalizedSegment) {
        expanded.add(normalizedSegment);
      }
    }
  }

  return [...expanded];
}

function getProviderlessSlug(model: AliasModelRecord): string | null {
  const providerSlug = makeSlug(model.provider);
  if (providerSlug && model.slug.startsWith(providerSlug + "-")) {
    return model.slug.slice(providerSlug.length + 1);
  }
  return null;
}

function modelPriority(
  model: AliasModelRecord,
  slugCandidates: Set<string>,
  nameCandidates: Set<string>
) {
  let score = 0;

  if (slugCandidates.has(model.slug)) score += 100;

  const providerlessSlug = getProviderlessSlug(model);
  if (providerlessSlug && slugCandidates.has(providerlessSlug)) score += 90;

  if (nameCandidates.has(model.name.toLowerCase())) score += 60;
  if (nameCandidates.has(normalizeNameKey(model.name))) score += 55;
  if (!DATE_SUFFIX_RE.test(model.slug)) score += 10;

  return score;
}

export function buildModelAliasIndex(models: AliasModelRecord[]): ModelAliasIndex {
  const slugToIds = new Map<string, string[]>();
  const nameToIds = new Map<string, string[]>();
  const idToModel = new Map<string, AliasModelRecord>();
  const baseToDatedIds = new Map<string, string[]>();

  for (const model of models) {
    idToModel.set(model.id, model);
    pushUnique(slugToIds, model.slug, model.id);
    pushUnique(nameToIds, model.name.toLowerCase(), model.id);
    pushUnique(nameToIds, normalizeNameKey(model.name), model.id);

    const providerlessSlug = getProviderlessSlug(model);
    if (providerlessSlug) {
      pushUnique(slugToIds, providerlessSlug, model.id);
    }

    const baseSlug = stripDateSuffix(model.slug);
    if (baseSlug !== model.slug) {
      pushUnique(baseToDatedIds, baseSlug, model.id);
    }

    if (providerlessSlug) {
      const providerlessBaseSlug = stripDateSuffix(providerlessSlug);
      if (providerlessBaseSlug !== providerlessSlug) {
        pushUnique(baseToDatedIds, providerlessBaseSlug, model.id);
      }
    }
  }

  return {
    models,
    idToModel,
    slugToIds,
    nameToIds,
    baseToDatedIds,
  };
}

export function resolveAliasFamilyModelIds(
  index: ModelAliasIndex,
  options: ResolveAliasFamilyOptions
) {
  const slugCandidates = uniqueNormalized(options.slugCandidates ?? [], (value) => makeSlug(value));
  const nameCandidates = uniqueNormalized(options.nameCandidates ?? [], (value) =>
    normalizeNameKey(value)
  );
  const matched = new Set<string>();

  for (const slug of slugCandidates) {
    for (const id of index.slugToIds.get(slug) ?? []) {
      matched.add(id);
    }
  }

  for (const name of nameCandidates) {
    for (const id of index.nameToIds.get(name) ?? []) {
      matched.add(id);
    }
  }

  if (matched.size === 0) {
    for (const [dbName, ids] of index.nameToIds) {
      if (
        nameCandidates.some(
          (candidate) =>
            dbName.includes(candidate) ||
            candidate.includes(dbName)
        )
      ) {
        ids.forEach((id) => matched.add(id));
      }
    }
  }

  if (matched.size === 0) {
    for (const [dbSlug, ids] of index.slugToIds) {
      if (
        slugCandidates.some(
          (candidate) =>
            dbSlug === candidate ||
            dbSlug.endsWith(`-${candidate}`) ||
            candidate.endsWith(`-${dbSlug}`)
        )
      ) {
        ids.forEach((id) => matched.add(id));
      }
    }
  }

  const expanded = new Set<string>();
  const queue = [...matched];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || expanded.has(currentId)) continue;

    expanded.add(currentId);

    const model = index.idToModel.get(currentId);
    if (!model) continue;

    const familyKeys = new Set<string>();
    familyKeys.add(model.slug);
    familyKeys.add(stripDateSuffix(model.slug));

    const providerlessSlug = getProviderlessSlug(model);
    if (providerlessSlug) {
      familyKeys.add(providerlessSlug);
      familyKeys.add(stripDateSuffix(providerlessSlug));
    }

    for (const key of familyKeys) {
      for (const siblingId of index.slugToIds.get(key) ?? []) {
        if (!expanded.has(siblingId)) queue.push(siblingId);
      }
      for (const datedId of index.baseToDatedIds.get(key) ?? []) {
        if (!expanded.has(datedId)) queue.push(datedId);
      }
    }
  }

  const slugSet = new Set(slugCandidates);
  const nameSet = new Set(nameCandidates);

  return [...expanded].sort((left, right) => {
    const leftModel = index.idToModel.get(left);
    const rightModel = index.idToModel.get(right);
    if (!leftModel || !rightModel) return left.localeCompare(right);

    const scoreDiff =
      modelPriority(rightModel, slugSet, nameSet) -
      modelPriority(leftModel, slugSet, nameSet);
    if (scoreDiff !== 0) return scoreDiff;

    const lengthDiff = leftModel.slug.length - rightModel.slug.length;
    if (lengthDiff !== 0) return lengthDiff;

    return leftModel.slug.localeCompare(rightModel.slug);
  });
}

export function resolveMatchedAliasFamilyModelIds(
  index: ModelAliasIndex,
  _models: AliasModelRecord[],
  aliases: Array<string | null | undefined>
) {
  const candidates = expandAliasCandidates(aliases);
  if (candidates.length === 0) return [];

  const exactFamilyIds = resolveAliasFamilyModelIds(index, {
    slugCandidates: candidates,
    nameCandidates: candidates,
  });

  if (exactFamilyIds.length > 0) {
    return exactFamilyIds;
  }
  return [];
}
