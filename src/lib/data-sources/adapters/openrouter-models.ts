/**
 * OpenRouter Models Adapter — PRIMARY Model Discovery
 *
 * Fetches ALL available AI models from the OpenRouter public catalog API
 * (GET https://openrouter.ai/api/v1/models). Auth is optional — the endpoint
 * works without a key, but providing OPENROUTER_API_KEY raises rate limits.
 *
 * Writes to:
 *   - models         (upsert on slug)
 *   - model_pricing  (insert per-model, provider_name="OpenRouter", skip on error)
 */

import type {
  DataSourceAdapter,
  SyncContext,
  SyncResult,
  SyncError,
  HealthCheckResult,
} from "../types";
import { registerAdapter } from "../registry";
import { fetchWithRetry, makeSlug, upsertBatch } from "../utils";
import { inferCategory } from "../shared/infer-category";
import { getCanonicalProviderName } from "@/lib/constants/providers";
import { resolveAnthropicKnownModelMeta } from "../shared/known-models/anthropic";
import { resolveGoogleKnownModelMeta } from "../shared/known-models/google";
import { resolveMiniMaxKnownModelMeta } from "../shared/known-models/minimax";
import { resolveMoonshotKnownModelMeta } from "../shared/known-models/moonshot";
import { resolveOpenAIKnownModelMeta } from "../shared/known-models/openai";
import { XAI_KNOWN_MODELS } from "../shared/known-models/xai";
import { resolveZAIKnownModelMeta } from "../shared/known-models/zai";

// --------------- Constants ---------------

const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";
const OPENROUTER_MODELS_URL = `${OPENROUTER_API_BASE}/models`;

// --------------- Provider Display Names ---------------

/**
 * Maps the OpenRouter model ID prefix (before the first "/") to a human-readable
 * provider display name. Unlisted prefixes are title-cased automatically.
 */
const PROVIDER_NAMES: Record<string, string> = {
  "openai": "OpenAI",
  "anthropic": "Anthropic",
  "google": "Google",
  "meta-llama": "Meta",
  "deepseek": "DeepSeek",
  "mistralai": "Mistral AI",
  "qwen": "Alibaba / Qwen",
  "x-ai": "xAI",
  "xai": "xAI",
  "z-ai": "Z.ai",
  "cohere": "Cohere",
  "microsoft": "Microsoft",
  "minimax": "MiniMax",
  "nvidia": "NVIDIA",
  "amazon": "Amazon",
  "moonshotai": "Moonshot AI",
  "moonshot": "Moonshot AI",
  "kimi": "Moonshot AI",
  "inflection": "Inflection AI",
  "perplexity": "Perplexity",
  "together": "Together AI",
  "fireworks": "Fireworks AI",
  "bytedance-seed": "ByteDance",
  "ai21": "AI21 Labs",
  "databricks": "Databricks",
  "01-ai": "01.AI",
  "nousresearch": "Nous Research",
  "cognitivecomputations": "Cognitive Computations",
  "liquid": "Liquid AI",
  "aion-labs": "Aion Labs",
  "thudm": "Tsinghua University",
  "sophosympatheia": "Sophosympatheia",
  "neversleep": "NeverSleep",
  "sao10k": "Sao10k",
  "thedrummer": "TheDrummer",
  "eva-unit-01": "Eva Unit 01",
  "featherless": "Featherless AI",
  "mancer": "Mancer",
  "lynn": "Lynn",
  "all-hands": "All Hands AI",
};

// --------------- OpenRouter API Types ---------------

interface OpenRouterArchitecture {
  modality?: string;
  input_modalities?: string[];
  output_modalities?: string[];
  tokenizer?: string;
}

interface OpenRouterPricing {
  prompt: string;
  completion: string;
  image?: string;
  request?: string;
}

interface OpenRouterModelEntry {
  id: string;
  name: string;
  created?: number;
  context_length?: number;
  description?: string;
  pricing?: OpenRouterPricing;
  architecture?: OpenRouterArchitecture;
  top_provider?: {
    context_length?: number;
    max_completion_tokens?: number;
    is_moderated?: boolean;
  };
}

interface OpenRouterModelsResponse {
  data: OpenRouterModelEntry[];
}

function resolveCuratedKnownMeta(id: string) {
  const [providerPrefix, modelPart = ""] = id.split("/");
  if (providerPrefix === "anthropic") return resolveAnthropicKnownModelMeta(modelPart);
  if (providerPrefix === "openai") return resolveOpenAIKnownModelMeta(modelPart);
  if (providerPrefix === "google") return resolveGoogleKnownModelMeta(modelPart);
  if (providerPrefix === "minimax") return resolveMiniMaxKnownModelMeta(modelPart);
  if (providerPrefix === "moonshotai" || providerPrefix === "moonshot" || providerPrefix === "kimi") {
    return resolveMoonshotKnownModelMeta(modelPart);
  }
  if (providerPrefix === "x-ai" || providerPrefix === "xai") return XAI_KNOWN_MODELS[modelPart];
  if (providerPrefix === "z-ai") return resolveZAIKnownModelMeta(modelPart);
  return undefined;
}

function resolveProviderCategoryDefaults(id: string) {
  const [providerPrefix] = id.split("/");

  if (providerPrefix === "anthropic") {
    return {
      category: "multimodal",
      modalities: ["text", "image"],
    } as const;
  }

  return null;
}

function inferCategoryFromOpenRouterModel(model: OpenRouterModelEntry) {
  const descriptionCategory = inferCategory({
    mode: "description",
    description: model.description ?? "",
  });
  if (descriptionCategory !== "specialized") {
    return descriptionCategory;
  }

  return inferCategory({ mode: "arch", arch: model.architecture ?? {} });
}

// --------------- Helper Functions ---------------

/**
 * Extract the display name for the provider from the model ID.
 * The model ID is structured as "provider/model-variant".
 * Returns a mapped display name or a title-cased version of the prefix.
 */
function extractProvider(id: string): string {
  const prefix = id.split("/")[0];
  return getCanonicalProviderName(
    PROVIDER_NAMES[prefix] ||
    prefix.charAt(0).toUpperCase() + prefix.slice(1)
  );
}

/**
 * Extract the model name from the OpenRouter name field.
 * The name field is often "Provider: Model Name" — strip the provider prefix.
 * Falls back to the part after "/" in the model ID.
 */
function extractModelName(name: string, id: string): string {
  // Name format is often "Provider: Model Name" — strip provider prefix
  const colonIdx = name.indexOf(":");
  if (colonIdx > 0 && colonIdx < 30) {
    return name.substring(colonIdx + 1).trim();
  }
  // Fallback: use the part after / in the id
  const slashIdx = id.indexOf("/");
  return slashIdx > 0 ? id.substring(slashIdx + 1) : name;
}

/**
 * Convert a UNIX timestamp to a YYYY-MM-DD date string.
 * Returns null if the timestamp is falsy.
 */
function unixToDateString(ts: number | undefined | null): string | null {
  if (!ts) return null;
  return new Date(ts * 1000).toISOString().split("T")[0];
}

/**
 * Merge input and output modalities into a unique sorted array.
 * Always includes at minimum ["text"] as a fallback.
 */
function mergeModalities(arch: OpenRouterArchitecture | undefined): string[] {
  if (!arch) return ["text"];
  const seen = new Set<string>();
  for (const m of arch.input_modalities ?? []) seen.add(m);
  for (const m of arch.output_modalities ?? []) seen.add(m);
  return seen.size > 0 ? Array.from(seen).sort() : ["text"];
}

/**
 * Known open-weight model provider prefixes on OpenRouter.
 * Models from these providers are typically released with open weights.
 */
const OPEN_WEIGHT_PROVIDERS = new Set([
  "meta-llama", "mistralai", "qwen", "deepseek",
  "microsoft", "nvidia", "01-ai", "nousresearch",
  "cognitivecomputations", "thudm", "bigcode", "stabilityai",
  "tiiuae", "databricks", "sophosympatheia", "neversleep",
  "sao10k", "thedrummer", "eva-unit-01", "featherless",
  "mancer", "lynn", "liquid", "bytedance-seed",
]);

/** Providers that are always proprietary / closed weights */
const PROPRIETARY_PROVIDERS = new Set([
  "openai", "anthropic", "cohere", "inflection",
  "perplexity", "x-ai", "xai", "amazon",
]);

const OPEN_WEIGHT_MODEL_PATTERNS = [
  /^openai\/gpt-oss(?:-|$)/i,
  /^cohere\/command-a(?:$|[-/])/i,
  /^cohere\/command-r(?:\+|$|[-/])/i,
] as const;

function inferOpenLicenseName(id: string, description: string | undefined): string | null {
  if (id.startsWith("meta-llama/")) return "Llama Community License";
  if (/^cohere\/command-r(?:\+|$|[-/])/i.test(id)) return "CC-BY-NC-4.0";

  const desc = (description ?? "").toLowerCase();
  if (desc.includes("apache 2.0") || desc.includes("apache-2.0")) return "Apache 2.0";
  if (desc.includes("mit license") || desc.includes("mit-licensed")) return "MIT";
  return null;
}

/**
 * Infer whether a model has open weights based on provider prefix and description.
 */
function inferOpenWeights(id: string, description: string | undefined): boolean {
  const prefix = id.split("/")[0];
  if (OPEN_WEIGHT_MODEL_PATTERNS.some((pattern) => pattern.test(id))) return true;
  if (PROPRIETARY_PROVIDERS.has(prefix)) return false;
  if (OPEN_WEIGHT_PROVIDERS.has(prefix)) return true;

  // Google catalog is mixed. Only Gemma-family style releases are open-weight.
  if (prefix === "google") {
    const modelPart = id.split("/")[1] ?? "";
    const normalized = modelPart.toLowerCase();
    return (
      normalized.startsWith("gemma") ||
      normalized.startsWith("embeddinggemma") ||
      normalized.startsWith("translategemma")
    );
  }

  // Check description for open-weight signals
  const desc = (description ?? "").toLowerCase();
  if (desc.includes("open weight") || desc.includes("open-weight") || desc.includes("apache") || desc.includes("mit license")) {
    return true;
  }

  return false;
}

/**
 * Build the models table record for a single OpenRouter model entry.
 */
function buildModelRecord(model: OpenRouterModelEntry): Record<string, unknown> {
  const arch = model.architecture ?? {};
  const isOpen = inferOpenWeights(model.id, model.description);
  const licenseName = inferOpenLicenseName(model.id, model.description) ?? (isOpen ? "Open weights" : null);
  const license = isOpen ? "open_source" : "commercial";
  const knownMeta = resolveCuratedKnownMeta(model.id);
  const providerDefaults = resolveProviderCategoryDefaults(model.id);

  return {
    slug: makeSlug(model.id),
    name: knownMeta?.name ?? extractModelName(model.name, model.id),
    provider: extractProvider(model.id),
    category:
      knownMeta?.category ??
      providerDefaults?.category ??
      inferCategoryFromOpenRouterModel(model),
    status: "active",
    description: knownMeta?.description ?? model.description ?? null,
    context_window:
      knownMeta?.context_window ??
      model.context_length ??
      model.top_provider?.context_length ??
      null,
    release_date: knownMeta?.release_date ?? unixToDateString(model.created),
    is_api_available: true,
    is_open_weights: knownMeta?.is_open_weights ?? isOpen,
    license: knownMeta?.license ?? license,
    license_name: "license_name" in (knownMeta ?? {}) ? (knownMeta?.license_name ?? null) : (isOpen ? licenseName : null),
    hf_model_id: knownMeta?.hf_model_id ?? null,
    website_url: knownMeta?.website_url ?? null,
    modalities: knownMeta?.modalities ?? providerDefaults?.modalities ?? mergeModalities(arch),
    capabilities: {},
    data_refreshed_at: new Date().toISOString(),
  };
}

/**
 * Determine whether a model's pricing is non-zero (i.e. worth recording).
 * A model has billable pricing if either prompt or completion is a non-zero
 * numeric string. Free-tier models (both "0") are still recorded with is_free_tier=true.
 */
function hasPricing(pricing: OpenRouterPricing | undefined): boolean {
  if (!pricing) return false;
  // Ensure both fields exist and parse to valid numbers
  const prompt = parseFloat(pricing.prompt ?? "");
  const completion = parseFloat(pricing.completion ?? "");
  return !isNaN(prompt) && !isNaN(completion);
}

// --------------- Adapter ---------------

const adapter: DataSourceAdapter = {
  id: "openrouter-models",
  name: "OpenRouter Models",
  outputTypes: ["models", "pricing"],
  defaultConfig: {},
  // Works without a key; providing one raises rate limits
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const errors: SyncError[] = [];
    const sb = ctx.supabase;

    // Optional API key — endpoint is public without auth
    const apiKey = ctx.secrets.OPENROUTER_API_KEY ?? process.env.OPENROUTER_API_KEY ?? "";

    const requestHeaders: Record<string, string> = {
      "Accept": "application/json",
      "HTTP-Referer": "https://aimarketcap.tech",
      "X-Title": "AI Market Cap",
    };
    if (apiKey) {
      requestHeaders["Authorization"] = `Bearer ${apiKey}`;
    }

    // ---- 1. Fetch all models from OpenRouter API ----
    let rawModels: OpenRouterModelEntry[];
    try {
      const res = await fetchWithRetry(
        OPENROUTER_MODELS_URL,
        { headers: requestHeaders, signal: ctx.signal },
        { signal: ctx.signal, maxRetries: 4, baseDelayMs: 1500 }
      );

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return {
          success: false,
          recordsProcessed: 0,
          recordsCreated: 0,
          recordsUpdated: 0,
          errors: [
            {
              message: `OpenRouter API returned ${res.status}: ${body.slice(0, 300)}`,
              context: "api_error",
            },
          ],
        };
      }

      const json: OpenRouterModelsResponse | OpenRouterModelEntry[] =
        await res.json();

      // Handle both { data: [...] } and direct array responses
      rawModels = Array.isArray(json)
        ? json
        : ((json as OpenRouterModelsResponse).data ?? []);
    } catch (err) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [
          {
            message: `Failed to fetch OpenRouter models: ${
              err instanceof Error ? err.message : String(err)
            }`,
            context: "network_error",
          },
        ],
      };
    }

    if (rawModels.length === 0) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [
          {
            message: "OpenRouter API returned an empty model list",
            context: "empty_response",
          },
        ],
      };
    }

    // ---- 2. Filter out :free suffix variants (they are duplicates) ----
    const models = rawModels.filter((m) => !m.id.includes(":free"));

    const totalFromApi = rawModels.length;
    const filteredCount = models.length;
    const skippedFreeVariants = totalFromApi - filteredCount;

    // ---- 3. Build model records and upsert to models table ----
    const modelRecords = models.map(buildModelRecord);

    const { created: modelsCreated, errors: modelUpsertErrors } =
      await upsertBatch(ctx.supabase, "models", modelRecords, "slug");
    errors.push(...modelUpsertErrors);

    // ---- 4. Pricing pass: resolve model UUIDs then upsert pricing ----
    //
    // model_pricing requires a real UUID FK (model_id), and we do not have
    // those until after the models upsert. We do a second pass: for each
    // model with parseable pricing, look up its UUID by slug, then insert
    // a pricing row. We skip on error rather than aborting the whole sync.

    const modelsWithPricing = models.filter((m) => hasPricing(m.pricing));
    let pricingInserted = 0;
    let pricingSkipped = 0;

    for (const model of modelsWithPricing) {
      const slug = makeSlug(model.id);
      const pricing = model.pricing!; // hasPricing guard above ensures this exists

      // Look up the model UUID
      const { data: found, error: lookupError } = await sb
        .from("models")
        .select("id")
        .eq("slug", slug)
        .limit(1)
        .single();

      if (lookupError || !found?.id) {
        // Model row not found — skip pricing rather than erroring
        pricingSkipped++;
        continue;
      }

      const promptPrice = parseFloat(pricing.prompt);
      const completionPrice = parseFloat(pricing.completion);

      // Guard: skip models with non-finite, negative, or absurdly large prices
      // (e.g. "bodybuilder", "auto" return -1 as sentinel for variable pricing)
      if (
        !isFinite(promptPrice) ||
        !isFinite(completionPrice) ||
        promptPrice < 0 ||
        completionPrice < 0 ||
        promptPrice >= 1 ||
        completionPrice >= 1
      ) {
        pricingSkipped++;
        continue;
      }

      // Convert per-token prices to per-million-token prices
      const inputPricePerMillion = promptPrice * 1_000_000;
      const outputPricePerMillion = completionPrice * 1_000_000;
      const isFree = promptPrice === 0 && completionPrice === 0;

      const blendedPrice = inputPricePerMillion * 0.6 + outputPricePerMillion * 0.4;

      const pricingRecord = {
        model_id: found.id as string,
        provider_name: "OpenRouter",
        pricing_model: "token_based",
        input_price_per_million: inputPricePerMillion,
        output_price_per_million: outputPricePerMillion,
        blended_price_per_million: blendedPrice,
        source: "openrouter",
        is_free_tier: isFree,
        currency: "USD",
        effective_date: new Date().toISOString().split("T")[0],
      };

      // model_pricing has UNIQUE constraint on (model_id, provider_name) — use upsert
      const { error: upsertError } = await sb
        .from("model_pricing")
        .upsert(pricingRecord, { onConflict: "model_id,provider_name" });

      if (upsertError) {
        errors.push({
          message: `Pricing upsert failed for ${model.id}: ${upsertError.message}`,
          context: `model_id=${found.id}`,
        });
        pricingSkipped++;
      } else {
        pricingInserted++;
      }
    }

    // ---- 5. Return consolidated result ----
    const totalRecordsCreated = modelsCreated + pricingInserted;

    return {
      success: errors.length === 0,
      recordsProcessed: filteredCount,
      recordsCreated: totalRecordsCreated,
      recordsUpdated: 0,
      errors,
      metadata: {
        source: "openrouter_api",
        totalFromApi,
        filteredCount,
        skippedFreeVariants,
        modelsUpserted: modelsCreated,
        pricingInserted,
        pricingSkipped,
        modelsWithPricingData: modelsWithPricing.length,
        authedRequest: Boolean(apiKey),
      },
    };
  },

  async healthCheck(
    secrets: Record<string, string>
  ): Promise<HealthCheckResult> {
    const apiKey =
      secrets.OPENROUTER_API_KEY ?? process.env.OPENROUTER_API_KEY ?? "";

    const headers: Record<string, string> = {
      Accept: "application/json",
      "HTTP-Referer": "https://aimarketcap.tech",
      "X-Title": "AI Market Cap",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const start = Date.now();
    try {
      const res = await fetchWithRetry(
        OPENROUTER_MODELS_URL,
        { headers },
        { maxRetries: 2, baseDelayMs: 1500 }
      );

      const latencyMs = Date.now() - start;

      if (res.ok) {
        return {
          healthy: true,
          latencyMs,
          message: `OpenRouter Models API reachable${apiKey ? " (authenticated)" : " (anonymous)"}`,
        };
      }

      return {
        healthy: false,
        latencyMs,
        message: `OpenRouter API returned HTTP ${res.status}`,
      };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: `OpenRouter API unreachable: ${
          err instanceof Error ? err.message : String(err)
        }`,
      };
    }
  },
};

registerAdapter(adapter);
export const __testables = {
  buildModelRecord,
  inferOpenWeights,
};
export default adapter;
