/**
 * Shared types and buildRecord() factory for the data-sources shared layer.
 *
 * This file defines the unified KnownModelMeta interface (superset of all
 * per-provider interfaces), the ProviderDefaults configuration type, and
 * the buildRecord() factory that produces normalized DB record objects.
 */

import { inferCategory, inferModalities } from "./infer-category";
import { makeSlug } from "../utils";

// ---------------------------------------------------------------------------
// Unified KnownModelMeta interface
// ---------------------------------------------------------------------------

/**
 * Unified model metadata interface — superset of all 4 provider interfaces.
 * All fields are optional except `name` and `description` so that each
 * provider's data file only needs to provide the fields it knows about.
 */
export interface KnownModelMeta {
  name: string;
  description: string;
  /** Model category (e.g. "llm", "multimodal", "image_generation"). Optional
   *  because some providers (Anthropic) hardcode it via ProviderDefaults. */
  category?: string;
  context_window?: number | null;
  release_date?: string | null;
  architecture?: string | null;
  status?: string;
  /** Modalities array (e.g. ["text","image"]). Optional because some providers
   *  (Anthropic) hardcode it via ProviderDefaults. */
  modalities?: string[];
  capabilities?: Record<string, boolean>;
  /** Whether model weights are publicly available. Optional because some
   *  providers (Anthropic, OpenAI) always hardcode false. */
  is_open_weights?: boolean;
  /** License type string (e.g. "commercial", "open_source"). Optional because
   *  some providers hardcode it via ProviderDefaults. */
  license?: string;
  license_name?: string | null;
  /** Parameter count in billions (OpenAI only). */
  parameter_count?: number | null;
}

// ---------------------------------------------------------------------------
// ProviderDefaults — provider-level fixed values passed to buildRecord()
// ---------------------------------------------------------------------------

/**
 * Provider-level defaults that apply to every model from this provider.
 * When set, these override inference from the model ID and/or known data.
 */
export interface ProviderDefaults {
  /** Human-readable provider name (e.g. "Anthropic"). */
  provider: string;
  /** Slug prefix for model IDs (e.g. "anthropic" → slug = "anthropic-claude-opus-4-6"). */
  slugPrefix: string;
  /** If set, all models from this provider get this category (skips inference). */
  category?: string;
  /** If set, all models from this provider get these modalities (skips inference). */
  modalities?: string[];
  is_open_weights?: boolean;
  license?: string;
  license_name?: string | null;
  architecture?: string | null;
}

// ---------------------------------------------------------------------------
// buildRecord() — normalized DB record factory
// ---------------------------------------------------------------------------

/**
 * The normalized DB record shape produced by buildRecord().
 * Maps to the `models` table columns.
 */
export interface ModelRecord {
  slug: string;
  name: string;
  provider: string;
  category: string;
  status: string;
  description: string | null;
  architecture: string | null;
  parameter_count: number | null;
  context_window: number | null;
  release_date: string | null;
  is_api_available: true;
  is_open_weights: boolean;
  license: string | undefined;
  license_name: string | null | undefined;
  modalities: string[];
  capabilities: Record<string, boolean>;
  data_refreshed_at: string;
}

/**
 * Build a normalized DB record for a model.
 *
 * Resolution order (later wins):
 *   knownData → overrides → ProviderDefaults (for category/modalities/license)
 *
 * Provider-level fixed values (category, modalities, license, is_open_weights)
 * always win over per-model knownData to enforce provider-wide consistency.
 *
 * @param modelId  - The raw model ID (e.g. "claude-opus-4-6", "gpt-4o")
 * @param knownData - Optional static metadata for this model
 * @param overrides - Per-call field overrides (wins over knownData)
 * @param defaults  - Provider-level configuration (provider name, slug prefix, fixed fields)
 */
export function buildRecord(
  modelId: string,
  knownData: KnownModelMeta | undefined,
  overrides: Partial<KnownModelMeta>,
  defaults: ProviderDefaults
): ModelRecord {
  // Merge known static data with per-call overrides (overrides win)
  const merged: Partial<KnownModelMeta> = { ...knownData, ...overrides };

  // Slug: "{slugPrefix}-{modelId}"
  const slug = makeSlug(`${defaults.slugPrefix}-${modelId}`);

  // Name: merged name if available, else fall back to raw modelId
  const name = merged.name ?? modelId;

  // Category: ProviderDefaults.category > merged.category > infer from model ID
  const category =
    defaults.category ??
    merged.category ??
    inferCategory({ mode: "id", modelId });

  // Modalities: ProviderDefaults.modalities > merged.modalities > infer from model ID
  const modalities =
    defaults.modalities ??
    merged.modalities ??
    inferModalities(modelId);

  // is_open_weights: ProviderDefaults > merged > false
  const is_open_weights =
    defaults.is_open_weights ??
    merged.is_open_weights ??
    false;

  return {
    slug,
    name,
    provider: defaults.provider,
    category,
    status: merged.status ?? "active",
    description: merged.description ?? null,
    architecture: defaults.architecture ?? merged.architecture ?? null,
    parameter_count: merged.parameter_count ?? null,
    context_window: merged.context_window ?? null,
    release_date: merged.release_date ?? null,
    is_api_available: true,
    is_open_weights,
    license: defaults.license ?? merged.license,
    license_name: "license_name" in defaults ? defaults.license_name : (merged.license_name ?? null),
    modalities,
    capabilities: merged.capabilities ?? {},
    data_refreshed_at: new Date().toISOString(),
  };
}
