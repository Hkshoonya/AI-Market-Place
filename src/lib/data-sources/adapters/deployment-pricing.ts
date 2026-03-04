/**
 * Deployment Pricing Adapter
 *
 * Fetches live pricing from platform APIs and updates model_deployments table.
 * For platforms without APIs, uses curated static pricing updated periodically.
 */

import type {
  DataSourceAdapter,
  SyncContext,
  SyncResult,
  HealthCheckResult,
} from "../types";
import { registerAdapter } from "../registry";

interface PricingEntry {
  platformSlug: string;
  modelPattern: string;
  pricingModel: import("@/types/database").DeploymentPricingModel;
  pricePerUnit: number;
  unitDescription: string;
  freeTier: string | null;
}

// Curated pricing for major platforms (updated periodically)
const CURATED_PRICING: PricingEntry[] = [
  // OpenAI API
  { platformSlug: "openai-api", modelPattern: "gpt-4.1", pricingModel: "per-token", pricePerUnit: 2.0, unitDescription: "M input tokens", freeTier: null },
  { platformSlug: "openai-api", modelPattern: "gpt-4o", pricingModel: "per-token", pricePerUnit: 2.5, unitDescription: "M input tokens", freeTier: null },
  { platformSlug: "openai-api", modelPattern: "o3", pricingModel: "per-token", pricePerUnit: 10.0, unitDescription: "M input tokens", freeTier: null },
  { platformSlug: "openai-api", modelPattern: "o4-mini", pricingModel: "per-token", pricePerUnit: 1.1, unitDescription: "M input tokens", freeTier: null },
  // Anthropic API
  { platformSlug: "anthropic-api", modelPattern: "claude-4-opus", pricingModel: "per-token", pricePerUnit: 15.0, unitDescription: "M input tokens", freeTier: null },
  { platformSlug: "anthropic-api", modelPattern: "claude-opus-4.6", pricingModel: "per-token", pricePerUnit: 15.0, unitDescription: "M input tokens", freeTier: null },
  { platformSlug: "anthropic-api", modelPattern: "claude-4-sonnet", pricingModel: "per-token", pricePerUnit: 3.0, unitDescription: "M input tokens", freeTier: null },
  // Google AI Studio (free tier)
  { platformSlug: "google-ai-studio", modelPattern: "gemini", pricingModel: "per-token", pricePerUnit: 0, unitDescription: "M input tokens", freeTier: "Free tier available" },
  // Groq (fast inference)
  { platformSlug: "groq", modelPattern: "llama", pricingModel: "per-token", pricePerUnit: 0.05, unitDescription: "M input tokens", freeTier: "Free tier: 30 RPM" },
  { platformSlug: "groq", modelPattern: "gemma", pricingModel: "per-token", pricePerUnit: 0.05, unitDescription: "M input tokens", freeTier: "Free tier: 30 RPM" },
  // Subscriptions
  { platformSlug: "chatgpt-plus", modelPattern: "gpt", pricingModel: "monthly", pricePerUnit: 20, unitDescription: "month", freeTier: null },
  { platformSlug: "chatgpt-pro", modelPattern: "gpt", pricingModel: "monthly", pricePerUnit: 200, unitDescription: "month", freeTier: null },
  { platformSlug: "claude-pro", modelPattern: "claude", pricingModel: "monthly", pricePerUnit: 20, unitDescription: "month", freeTier: null },
  { platformSlug: "gemini-advanced", modelPattern: "gemini", pricingModel: "monthly", pricePerUnit: 20, unitDescription: "month", freeTier: null },
  { platformSlug: "perplexity-pro", modelPattern: "perplexity", pricingModel: "monthly", pricePerUnit: 20, unitDescription: "month", freeTier: null },
  // Self-hosted
  { platformSlug: "runpod", modelPattern: "llama", pricingModel: "per-second", pricePerUnit: 0.00031, unitDescription: "GPU-sec (A100)", freeTier: null },
  { platformSlug: "vast-ai", modelPattern: "llama", pricingModel: "per-second", pricePerUnit: 0.0002, unitDescription: "GPU-sec", freeTier: null },
  // Local (free)
  { platformSlug: "ollama", modelPattern: "llama", pricingModel: "free", pricePerUnit: 0, unitDescription: "", freeTier: "Free (local)" },
  { platformSlug: "lm-studio", modelPattern: "llama", pricingModel: "free", pricePerUnit: 0, unitDescription: "", freeTier: "Free (local)" },
  { platformSlug: "llamacpp", modelPattern: "llama", pricingModel: "free", pricePerUnit: 0, unitDescription: "", freeTier: "Free (local)" },
];

const adapter: DataSourceAdapter = {
  id: "deployment-pricing",
  name: "Deployment Pricing",
  outputTypes: ["pricing"],
  defaultConfig: {},
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const { supabase } = ctx;
    let recordsProcessed = 0;
    let recordsCreated = 0;
    const errors: { message: string; context?: string }[] = [];

    // Get all platforms
    const { data: platforms } = await supabase
      .from("deployment_platforms")
      .select("id, slug");

    if (!platforms) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ message: "No platforms found", context: "deployment_platforms query" }],
      };
    }

    const platformMap = new Map(
      platforms.map((p: { id: string; slug: string }) => [p.slug, p.id])
    );

    // Get all models
    const { data: models } = await supabase
      .from("models")
      .select("id, name, slug, provider, is_open_weights")
      .eq("status", "active");

    if (!models) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ message: "No models found", context: "models query" }],
      };
    }

    for (const entry of CURATED_PRICING) {
      const platformId = platformMap.get(entry.platformSlug);
      if (!platformId) continue;

      // Find matching models
      const matchingModels = models.filter(
        (m: { name: string; slug: string }) =>
          m.name.toLowerCase().includes(entry.modelPattern) ||
          m.slug.includes(entry.modelPattern)
      );

      for (const model of matchingModels) {
        recordsProcessed++;
        const { error } = await supabase
          .from("model_deployments")
          .upsert(
            {
              model_id: model.id,
              platform_id: platformId,
              pricing_model: entry.pricingModel,
              price_per_unit: entry.pricePerUnit,
              unit_description: entry.unitDescription,
              free_tier: entry.freeTier,
              status: "available",
              last_price_check: new Date().toISOString(),
            },
            { onConflict: "model_id,platform_id" }
          );

        if (error) {
          errors.push({
            message: `${entry.platformSlug}/${model.slug}: ${error.message}`,
            context: "model_deployments upsert",
          });
        } else {
          recordsCreated++;
        }
      }
    }

    return {
      success: errors.length === 0,
      recordsProcessed,
      recordsCreated,
      recordsUpdated: 0,
      errors,
    };
  },

  async healthCheck(): Promise<HealthCheckResult> {
    return { healthy: true, latencyMs: 0, message: "Curated pricing data source" };
  },
};

registerAdapter(adapter);
export default adapter;
