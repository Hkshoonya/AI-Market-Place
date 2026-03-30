import { formatParams } from "@/lib/format";
import { ANTHROPIC_KNOWN_MODELS } from "@/lib/data-sources/shared/known-models/anthropic";
import { GOOGLE_KNOWN_MODELS } from "@/lib/data-sources/shared/known-models/google";
import { MINIMAX_KNOWN_MODELS } from "@/lib/data-sources/shared/known-models/minimax";
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
  minimax: MINIMAX_KNOWN_MODELS,
  "moonshot ai": MOONSHOT_KNOWN_MODELS,
  kimi: MOONSHOT_KNOWN_MODELS,
  xai: XAI_KNOWN_MODELS,
  "z.ai": ZAI_KNOWN_MODELS,
  "zai-org": ZAI_KNOWN_MODELS,
};

export interface PresentableModel {
  slug: string;
  name: string;
  provider: string;
  category?: string | null;
  description?: string | null;
  short_description?: string | null;
  is_open_weights?: boolean | null;
  parameter_count?: number | null;
  context_window?: number | null;
  capabilities?: Record<string, boolean> | null;
}

export interface ModelDisplayDescription {
  text: string | null;
  source: "catalog" | "official_catalog" | "synthetic";
}

export interface ParameterDisplay {
  value: number | null;
  label: string;
  source: "catalog" | "inferred" | "undisclosed" | "unknown";
}

export interface FallbackOverview {
  summary: string | null;
  highlights: Array<{
    label: string;
    value: string;
    tone: "verified" | "estimated" | "generated" | "coverage";
  }>;
  pros: Array<{ title: string; description: string; source: string }>;
  cons: Array<{ title: string; description: string; source: string }>;
  best_for: string[];
  not_ideal_for: string[];
  evidence_badges: string[];
  methodology: {
    hiddenByDefault: boolean;
    summary: string;
    sourceLabels: string[];
    confidenceLabel: string;
  };
  comparison_notes: string | null;
  generated_by: string;
  upvotes: number;
  downvotes: number;
}

function canonicalize(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
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

function stripTrailingVariantSuffixes(value: string): string {
  return value
    .replace(/(?:[-_/](?:20\d{2}(?:[-_/]?\d{2}){1,2}|\d{8}))(?:[-_/]v\d+)?$/i, "")
    .replace(/(?:[-_/]v\d+)$/i, "")
    .replace(/(?:[-_/](?:latest|preview|snapshot|experimental|exp|stable|release|highspeed))+$/gi, "");
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

function tokenizeModelIdentity(value: string | null | undefined, provider?: string): string[] {
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

function buildTokenSignature(value: string | null | undefined, provider?: string): string {
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

function toSentenceSummary(value: string, maxLength = 320): string {
  if (value.length <= maxLength) return value;

  const sentences = value.match(/[^.!?]+[.!?]+/g) ?? [];
  let combined = "";

  for (const sentence of sentences) {
    const next = `${combined} ${sentence}`.trim();
    if (next.length > maxLength) break;
    combined = next;
    if (combined.length >= Math.min(220, maxLength)) break;
  }

  if (combined) return combined.trim();
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function cleanText(value: string | null | undefined): string | null {
  if (!value) return null;
  let stripped = value
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[`*_>#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const cutoffPatterns = [
    /\bFor more information, please see\b/i,
    /\bTo read more about the model release\b/i,
    /\bUsage of this model is subject to\b/i,
    /\bClick here for more information\b/i,
  ];

  for (const pattern of cutoffPatterns) {
    const match = stripped.match(pattern);
    if (match?.index != null) {
      stripped = stripped.slice(0, match.index).trim();
    }
  }

  if (stripped.length === 0) return null;
  return toSentenceSummary(stripped);
}

function isSuspiciousDescriptionText(
  rawValue: string | null | undefined,
  cleanedValue: string | null
): boolean {
  if (!cleanedValue) return true;
  if (cleanedValue.length < 55) return true;

  const raw = rawValue ?? "";
  if (/TensorFlow-based neural network library/i.test(cleanedValue)) return true;
  if (/Tensors and Dynamic neural networks in Python/i.test(cleanedValue)) return true;
  if (/^this model is a placeholder$/i.test(raw.trim())) return true;

  return false;
}

function getProviderCatalog(provider: string): KnownCatalog | null {
  const normalized = provider.toLowerCase().trim();
  return KNOWN_MODEL_CATALOGS[normalized] ?? null;
}

function findKnownModelMeta(model: PresentableModel): KnownModelMeta | null {
  const catalog = getProviderCatalog(model.provider);
  if (!catalog) return null;

  const slugWithoutProvider = model.slug.includes("-")
    ? model.slug.substring(model.slug.indexOf("-") + 1)
    : model.slug;
  const candidateKeys = new Set(
    [
      model.slug,
      slugWithoutProvider,
      stripTrailingVariantSuffixes(model.slug),
      stripTrailingVariantSuffixes(slugWithoutProvider),
      model.name,
      stripTrailingVariantSuffixes(model.name),
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

function buildSyntheticDescription(model: PresentableModel): string {
  const category = model.category ? model.category.replace(/_/g, " ") : "AI";
  const modelType = model.is_open_weights ? "open-weight" : "proprietary";
  const contextWindow =
    model.context_window && model.context_window > 0
      ? ` with a ${model.context_window.toLocaleString()} token context window`
      : "";
  const capabilityKeys = Object.entries(model.capabilities ?? {})
    .filter(([, enabled]) => enabled)
    .map(([key]) => key.replace(/_/g, " "))
    .slice(0, 3);

  const capabilityText =
    capabilityKeys.length > 0
      ? ` focused on ${capabilityKeys.join(", ")}`
      : "";

  return `${model.name} is a ${modelType} ${model.provider} ${category} model${contextWindow}${capabilityText}.`;
}

function inferParameterCountFromText(value: string): number | null {
  const text = value.toLowerCase();

  const moeMatch = text.match(/(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)b\b/);
  if (moeMatch) {
    return Math.round(Number(moeMatch[1]) * Number(moeMatch[2]) * 1_000_000_000);
  }

  const expertMatch = text.match(/\be(\d+(?:\.\d+)?)b\b/);
  if (expertMatch) {
    return Math.round(Number(expertMatch[1]) * 1_000_000_000);
  }

  const sizeMatch = text.match(/(?:^|[^a-z0-9])(\d+(?:\.\d+)?)\s*([bmk])\b/);
  if (!sizeMatch) return null;

  const valueNumber = Number(sizeMatch[1]);
  const unit = sizeMatch[2];
  if (unit === "b") return Math.round(valueNumber * 1_000_000_000);
  if (unit === "m") return Math.round(valueNumber * 1_000_000);
  if (unit === "k") return Math.round(valueNumber * 1_000);
  return null;
}

function inferUseCases(model: PresentableModel): string[] {
  const capabilities = Object.entries(model.capabilities ?? {})
    .filter(([, enabled]) => enabled)
    .map(([key]) => key.replace(/_/g, " "));

  const categoryUseCases: Record<string, string[]> = {
    llm: ["general reasoning", "analysis", "assistant workflows"],
    multimodal: ["multimodal analysis", "vision tasks", "tool-assisted workflows"],
    code: ["coding", "code review", "developer automation"],
    agentic_browser: ["browser automation", "web workflows", "agent tasks"],
    embeddings: ["retrieval", "semantic search", "classification"],
  };

  return [...capabilities, ...(categoryUseCases[model.category ?? ""] ?? [])].slice(0, 4);
}

export function getModelDisplayDescription(model: PresentableModel): ModelDisplayDescription {
  const cleanedDescription = cleanText(model.description);
  const cleanedShortDescription = cleanText(model.short_description);
  const descriptionIsSuspicious = isSuspiciousDescriptionText(
    model.description,
    cleanedDescription
  );
  const shortDescriptionIsSuspicious = isSuspiciousDescriptionText(
    model.short_description,
    cleanedShortDescription
  );

  if (cleanedDescription && !descriptionIsSuspicious) {
    return { text: cleanedDescription, source: "catalog" };
  }

  if (cleanedShortDescription && !shortDescriptionIsSuspicious) {
    return { text: cleanedShortDescription, source: "catalog" };
  }

  const knownMeta = findKnownModelMeta(model);
  const officialText = cleanText(knownMeta?.description);
  if (officialText && !isSuspiciousDescriptionText(knownMeta?.description, officialText)) {
    return { text: officialText, source: "official_catalog" };
  }

  if (cleanedDescription && !descriptionIsSuspicious && cleanedDescription.length >= 80) {
    return { text: cleanedDescription, source: "catalog" };
  }

  if (
    cleanedShortDescription &&
    !shortDescriptionIsSuspicious &&
    cleanedShortDescription.length >= 55
  ) {
    return { text: cleanedShortDescription, source: "catalog" };
  }

  if (officialText) {
    return { text: officialText, source: "official_catalog" };
  }

  if (cleanedDescription && !descriptionIsSuspicious) {
    return { text: cleanedDescription, source: "catalog" };
  }

  if (cleanedShortDescription && !shortDescriptionIsSuspicious) {
    return { text: cleanedShortDescription, source: "catalog" };
  }

  return { text: buildSyntheticDescription(model), source: "synthetic" };
}

export function getParameterDisplay(model: PresentableModel): ParameterDisplay {
  if (model.parameter_count != null && model.parameter_count > 0) {
    return {
      value: model.parameter_count,
      label: formatParams(model.parameter_count),
      source: "catalog",
    };
  }

  const inferred =
    inferParameterCountFromText(`${model.name} ${model.slug} ${model.short_description ?? ""}`) ??
    inferParameterCountFromText(`${model.description ?? ""}`);

  if (inferred != null) {
    return {
      value: inferred,
      label: formatParams(inferred),
      source: "inferred",
    };
  }

  if (!model.is_open_weights) {
    return { value: null, label: "Undisclosed", source: "undisclosed" };
  }

  return { value: null, label: "Unknown", source: "unknown" };
}

export function buildFallbackOverview(model: PresentableModel): FallbackOverview {
  const description = getModelDisplayDescription(model);
  const useCases = inferUseCases(model);
  const parameterDisplay = getParameterDisplay(model);

  const highlights: FallbackOverview["highlights"] = [
    {
      label: "Model Type",
      value: model.category ? model.category.replace(/_/g, " ") : "AI model",
      tone: "generated",
    },
    {
      label: "Parameter Footprint",
      value: parameterDisplay.label,
      tone:
        parameterDisplay.source === "catalog"
          ? "verified"
          : parameterDisplay.source === "inferred"
            ? "estimated"
            : "coverage",
    },
  ];

  if (model.context_window && model.context_window > 0) {
    highlights.push({
      label: "Context Window",
      value: `${model.context_window.toLocaleString()} tokens`,
      tone: "verified",
    });
  }

  if (useCases[0]) {
    highlights.push({
      label: "Best Fit",
      value: useCases[0],
      tone: "generated",
    });
  }

  const pros = useCases.slice(0, 2).map((item) => ({
    title: item[0]?.toUpperCase() + item.slice(1),
    description: `${model.name} is positioned for ${item}.`,
    source: "catalog_fallback",
  }));

  const cons = [
    {
      title: "Coverage still evolving",
      description:
        "Some benchmark, pricing, or deployment signals are still incomplete for this model and will improve as new sources sync.",
      source: "catalog_fallback",
    },
  ];

  return {
    summary: description.text,
    highlights,
    pros,
    cons,
    best_for: useCases.slice(0, 4),
    not_ideal_for: model.is_open_weights ? [] : ["fully offline self-hosting"],
    evidence_badges: [
      "Generated Overview",
      description.source === "official_catalog" ? "Official Catalog" : "Catalog Metadata",
    ],
    methodology: {
      hiddenByDefault: true,
      summary:
        "This explanation is generated from provider metadata, synced model fields, and known catalog references. It is meant to help users understand the model quickly without treating generated language as primary-source documentation.",
      sourceLabels: Array.from(new Set([description.source, "synthetic"])),
      confidenceLabel:
        description.source === "official_catalog" || description.source === "catalog"
          ? "Source-grounded"
          : "Generated fallback",
    },
    comparison_notes:
      "This overview is generated from catalog metadata, official model descriptors, and synced platform signals.",
    generated_by: "catalog_fallback",
    upvotes: 0,
    downvotes: 0,
  };
}
