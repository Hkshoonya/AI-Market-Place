/**
 * Shared types for the data-sources shared layer.
 *
 * This file defines the unified KnownModelMeta interface (superset of all
 * per-provider interfaces) and the ProviderDefaults configuration type.
 * The buildRecord() factory function lives here in Plan 02.
 */

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
