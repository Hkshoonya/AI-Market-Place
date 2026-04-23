import { ANTHROPIC_KNOWN_MODELS } from "@/lib/data-sources/shared/known-models/anthropic";
import { BLACK_FOREST_LABS_KNOWN_MODELS } from "@/lib/data-sources/shared/known-models/black-forest-labs";
import { GOOGLE_KNOWN_MODELS } from "@/lib/data-sources/shared/known-models/google";
import { META_KNOWN_MODELS } from "@/lib/data-sources/shared/known-models/meta";
import { MINIMAX_KNOWN_MODELS } from "@/lib/data-sources/shared/known-models/minimax";
import { MISTRAL_KNOWN_MODELS } from "@/lib/data-sources/shared/known-models/mistral";
import { MOONSHOT_KNOWN_MODELS } from "@/lib/data-sources/shared/known-models/moonshot";
import { OPENAI_KNOWN_MODELS } from "@/lib/data-sources/shared/known-models/openai";
import { XAI_KNOWN_MODELS } from "@/lib/data-sources/shared/known-models/xai";
import { ZAI_KNOWN_MODELS } from "@/lib/data-sources/shared/known-models/zai";
import type { KnownModelMeta } from "@/lib/data-sources/shared/build-record";

type KnownCatalog = Record<string, KnownModelMeta>;

const KNOWN_MODEL_CATALOGS: Record<string, KnownCatalog> = {
  openai: OPENAI_KNOWN_MODELS,
  google: GOOGLE_KNOWN_MODELS,
  anthropic: ANTHROPIC_KNOWN_MODELS,
  meta: META_KNOWN_MODELS,
  "mistral ai": MISTRAL_KNOWN_MODELS,
  minimax: MINIMAX_KNOWN_MODELS,
  "moonshot ai": MOONSHOT_KNOWN_MODELS,
  kimi: MOONSHOT_KNOWN_MODELS,
  xai: XAI_KNOWN_MODELS,
  "z.ai": ZAI_KNOWN_MODELS,
  "zai-org": ZAI_KNOWN_MODELS,
  "black forest labs": BLACK_FOREST_LABS_KNOWN_MODELS,
};

export interface KnownModelLookupInput {
  slug?: string | null;
  name?: string | null;
  provider?: string | null;
}

export interface KnownModelPatchInput extends KnownModelLookupInput {
  category?: string | null;
  release_date?: string | null;
  context_window?: number | null;
  is_open_weights?: boolean | null;
  license?: string | null;
  license_name?: string | null;
  hf_model_id?: string | null;
  website_url?: string | null;
}

const IGNORED_MATCH_TOKENS = new Set([
  "latest",
  "preview",
  "snapshot",
  "experimental",
  "exp",
  "stable",
  "release",
  "highspeed",
  "fastest",
]);

const ALLOWED_VARIANT_TOKENS = new Set([
  "chat",
  "it",
  "instruct",
  "fast",
  "lite",
  "mini",
  "nano",
  "live",
  "image",
  "audio",
  "realtime",
  "turbo",
  "generate",
  "thinking",
  "research",
  "deep",
  "code",
]);

function canonicalize(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function stripTrailingVariantSuffixes(value: string): string {
  return value
    .replace(/(?:[-_/](?:20\d{2}(?:[-_/]?\d{2}){1,2}|\d{8}))(?:[-_/]v\d+)?$/i, "")
    .replace(/(?:[-_/]v\d+)$/i, "")
    .replace(
      /(?:[-_/](?:latest|preview|snapshot|experimental|exp|stable|release|highspeed))+$/gi,
      ""
    );
}

function buildProviderTokens(provider: string): Set<string> {
  return new Set(
    provider
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter(Boolean)
  );
}

function tokenizeModelIdentity(
  value: string | null | undefined,
  provider?: string | null
): string[] {
  const providerTokens = provider ? buildProviderTokens(provider) : new Set<string>();
  const stripped = stripTrailingVariantSuffixes(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");

  return stripped
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !providerTokens.has(token))
    .filter((token) => !IGNORED_MATCH_TOKENS.has(token))
    .filter((token) => !/^v\d+$/i.test(token))
    .filter((token) => !/^\d{6,8}$/.test(token));
}

function buildTokenSignature(
  value: string | null | undefined,
  provider?: string | null
): string {
  return tokenizeModelIdentity(value, provider).sort().join("|");
}

function isAllowedVariantToken(token: string): boolean {
  return (
    ALLOWED_VARIANT_TOKENS.has(token) ||
    /^\d+(?:b|m|k)$/.test(token) ||
    /^[a-z]\d+b$/.test(token) ||
    /^\d{1,4}$/.test(token)
  );
}

function isSubsetTokenMatch(
  candidateValue: string | null | undefined,
  catalogValue: string | null | undefined,
  provider: string
): boolean {
  const candidateTokens = tokenizeModelIdentity(candidateValue, provider);
  const catalogTokens = tokenizeModelIdentity(catalogValue, provider);
  if (catalogTokens.length < 2 || candidateTokens.length < catalogTokens.length) {
    return false;
  }

  if (!catalogTokens.every((token) => candidateTokens.includes(token))) {
    return false;
  }

  if (!catalogTokens.every((token, index) => candidateTokens[index] === token)) {
    return false;
  }

  const extras = candidateTokens.filter((token) => !catalogTokens.includes(token));
  return extras.every((token) => isAllowedVariantToken(token));
}

function getProviderCatalog(provider: string | null | undefined): KnownCatalog | null {
  const normalized = provider?.toLowerCase().trim();
  if (!normalized) return null;
  return KNOWN_MODEL_CATALOGS[normalized] ?? null;
}

export function getKnownModelMeta(
  model: KnownModelLookupInput
): KnownModelMeta | null {
  const catalog = getProviderCatalog(model.provider);
  if (!catalog || !model.provider) return null;

  const slugWithoutProvider = model.slug?.includes("-")
    ? model.slug.substring(model.slug.indexOf("-") + 1)
    : model.slug;
  const candidateKeys = new Set(
    [
      model.slug,
      slugWithoutProvider,
      stripTrailingVariantSuffixes(model.slug ?? ""),
      stripTrailingVariantSuffixes(slugWithoutProvider ?? ""),
      model.name,
      stripTrailingVariantSuffixes(model.name ?? ""),
    ]
      .map((value) => canonicalize(value))
      .filter(Boolean)
  );
  const candidateSignatures = new Set(
    [model.slug, slugWithoutProvider, model.name]
      .map((value) => buildTokenSignature(value, model.provider))
      .filter(Boolean)
  );

  for (const [key, meta] of Object.entries(catalog)) {
    const normalizedCandidates = [
      key,
      stripTrailingVariantSuffixes(key),
      meta.name,
      stripTrailingVariantSuffixes(meta.name),
    ]
      .map((value) => canonicalize(value))
      .filter(Boolean);
    const tokenSignatures = [
      buildTokenSignature(key, model.provider),
      buildTokenSignature(meta.name, model.provider),
    ].filter(Boolean);

    if (normalizedCandidates.some((value) => candidateKeys.has(value))) {
      return meta;
    }

    if (tokenSignatures.some((signature) => candidateSignatures.has(signature))) {
      return meta;
    }

    if (
      isSubsetTokenMatch(model.slug, key, model.provider) ||
      isSubsetTokenMatch(model.slug, meta.name, model.provider) ||
      isSubsetTokenMatch(model.name, key, model.provider) ||
      isSubsetTokenMatch(model.name, meta.name, model.provider)
    ) {
      return meta;
    }
  }

  return null;
}

function hasString(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function hasPositiveNumber(value: number | null | undefined): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function buildKnownModelMetaPatch(
  model: KnownModelPatchInput
): Record<string, unknown> {
  const knownMeta = getKnownModelMeta(model);
  if (!knownMeta) return {};

  return Object.fromEntries(
    Object.entries({
      name: hasString(model.name) ? undefined : knownMeta.name,
      category: hasString(model.category) ? undefined : knownMeta.category,
      release_date: hasString(model.release_date) ? undefined : knownMeta.release_date,
      context_window: hasPositiveNumber(model.context_window)
        ? undefined
        : knownMeta.context_window,
      is_open_weights:
        typeof model.is_open_weights === "boolean"
          ? undefined
          : knownMeta.is_open_weights,
      license: hasString(model.license) ? undefined : knownMeta.license,
      license_name: hasString(model.license_name)
        ? undefined
        : knownMeta.license_name,
      hf_model_id: hasString(model.hf_model_id) ? undefined : knownMeta.hf_model_id,
      website_url: hasString(model.website_url) ? undefined : knownMeta.website_url,
    }).filter(([, value]) => value !== undefined && value !== null)
  ) as Record<string, unknown>;
}
