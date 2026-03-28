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
  modelPatterns: string[];
  providerPatterns?: string[];
  excludePatterns?: string[];
  pricingModel: import("@/types/database").DeploymentPricingModel;
  pricePerUnit: number | null;
  unitDescription: string;
  freeTier: string | null;
}

// Curated pricing for major platforms (updated periodically)
const CURATED_PRICING: PricingEntry[] = [
  // OpenAI API
  { platformSlug: "openai-api", modelPatterns: ["gpt-4.1"], pricingModel: "per-token", pricePerUnit: 2.0, unitDescription: "M input tokens", freeTier: null },
  { platformSlug: "openai-api", modelPatterns: ["gpt-4o"], pricingModel: "per-token", pricePerUnit: 2.5, unitDescription: "M input tokens", freeTier: null },
  { platformSlug: "openai-api", modelPatterns: ["o3"], pricingModel: "per-token", pricePerUnit: 10.0, unitDescription: "M input tokens", freeTier: null },
  { platformSlug: "openai-api", modelPatterns: ["o4-mini"], pricingModel: "per-token", pricePerUnit: 1.1, unitDescription: "M input tokens", freeTier: null },
  // Anthropic API
  { platformSlug: "anthropic-api", modelPatterns: ["claude-4-opus"], pricingModel: "per-token", pricePerUnit: 15.0, unitDescription: "M input tokens", freeTier: null },
  { platformSlug: "anthropic-api", modelPatterns: ["claude-opus-4.6"], pricingModel: "per-token", pricePerUnit: 15.0, unitDescription: "M input tokens", freeTier: null },
  { platformSlug: "anthropic-api", modelPatterns: ["claude-4-sonnet"], pricingModel: "per-token", pricePerUnit: 3.0, unitDescription: "M input tokens", freeTier: null },
  // Google AI Studio (free tier)
  { platformSlug: "google-ai-studio", modelPatterns: ["gemini"], pricingModel: "per-token", pricePerUnit: 0, unitDescription: "M input tokens", freeTier: "Free tier available" },
  // Groq (fast inference)
  { platformSlug: "groq", modelPatterns: ["llama"], pricingModel: "per-token", pricePerUnit: 0.05, unitDescription: "M input tokens", freeTier: "Free tier: 30 RPM" },
  { platformSlug: "groq", modelPatterns: ["gemma"], pricingModel: "per-token", pricePerUnit: 0.05, unitDescription: "M input tokens", freeTier: "Free tier: 30 RPM" },
  // Subscriptions
  { platformSlug: "chatgpt-plus", modelPatterns: ["gpt"], pricingModel: "monthly", pricePerUnit: 20, unitDescription: "month", freeTier: null },
  { platformSlug: "chatgpt-pro", modelPatterns: ["gpt"], pricingModel: "monthly", pricePerUnit: 200, unitDescription: "month", freeTier: null },
  { platformSlug: "claude-pro", modelPatterns: ["claude"], pricingModel: "monthly", pricePerUnit: 20, unitDescription: "month", freeTier: null },
  { platformSlug: "gemini-advanced", modelPatterns: ["gemini"], pricingModel: "monthly", pricePerUnit: 20, unitDescription: "month", freeTier: null },
  { platformSlug: "perplexity-pro", modelPatterns: ["sonar", "perplexity"], providerPatterns: ["perplexity"], pricingModel: "monthly", pricePerUnit: 20, unitDescription: "month", freeTier: null },
  { platformSlug: "grok-premium", modelPatterns: ["grok"], providerPatterns: ["xai", "grok"], pricingModel: "monthly", pricePerUnit: 8, unitDescription: "month", freeTier: null },
  { platformSlug: "minimax-coding-plan", modelPatterns: ["minimax-m2", "minimax m2"], providerPatterns: ["minimax"], excludePatterns: ["speech", "music", "video", "hailuo"], pricingModel: "monthly", pricePerUnit: 29, unitDescription: "month", freeTier: null },
  { platformSlug: "kimi-code-membership", modelPatterns: ["kimi"], providerPatterns: ["moonshot", "kimi"], pricingModel: "monthly", pricePerUnit: null, unitDescription: "month", freeTier: null },
  { platformSlug: "glm-coding-plan", modelPatterns: ["glm-5", "glm-4.7", "glm-4.6", "glm-4.5", "glm-4.5-air"], providerPatterns: ["z.ai", "zai", "glm"], excludePatterns: ["image", "ocr", "asr", "cogview"], pricingModel: "monthly", pricePerUnit: 10, unitDescription: "month", freeTier: null },
  // Self-hosted
  { platformSlug: "runpod", modelPatterns: ["llama"], pricingModel: "per-second", pricePerUnit: 0.00031, unitDescription: "GPU-sec (A100)", freeTier: null },
  { platformSlug: "vast-ai", modelPatterns: ["llama"], pricingModel: "per-second", pricePerUnit: 0.0002, unitDescription: "GPU-sec", freeTier: null },
  // Local (free)
  { platformSlug: "ollama", modelPatterns: ["llama"], pricingModel: "free", pricePerUnit: 0, unitDescription: "", freeTier: "Free (local)" },
  { platformSlug: "lm-studio", modelPatterns: ["llama"], pricingModel: "free", pricePerUnit: 0, unitDescription: "", freeTier: "Free (local)" },
  { platformSlug: "llamacpp", modelPatterns: ["llama"], pricingModel: "free", pricePerUnit: 0, unitDescription: "", freeTier: "Free (local)" },
];

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").toLowerCase();
}

function matchesPricingEntry(
  entry: PricingEntry,
  model: { name: string; slug: string; provider: string }
): boolean {
  const haystack = `${normalizeText(model.name)} ${normalizeText(model.slug)} ${normalizeText(model.provider)}`;

  const matchesModelPattern = entry.modelPatterns.some((pattern) => haystack.includes(normalizeText(pattern)));
  if (!matchesModelPattern) return false;

  if (entry.providerPatterns && !entry.providerPatterns.some((pattern) => normalizeText(model.provider).includes(normalizeText(pattern)))) {
    return false;
  }

  if (entry.excludePatterns?.some((pattern) => haystack.includes(normalizeText(pattern)))) {
    return false;
  }

  return true;
}

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
        (m: { name: string; slug: string; provider: string }) => matchesPricingEntry(entry, m)
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
