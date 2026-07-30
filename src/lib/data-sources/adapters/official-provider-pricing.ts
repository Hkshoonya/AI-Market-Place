/**
 * Official Provider Pricing Adapter
 *
 * Verifies current direct-provider prices from first-party model pages. This
 * source intentionally writes only canonical provider rows; marketplace and
 * router prices remain owned by their respective adapters.
 */

import type {
  DataSourceAdapter,
  HealthCheckResult,
  SyncContext,
  SyncResult,
} from "../types";
import { registerAdapter } from "../registry";

interface OfficialPricingDefinition {
  provider: "OpenAI";
  modelSlugs: string[];
  documentUrl: string;
  sourceUrl: string;
}

interface ParsedTokenPricing {
  inputPricePerMillion: number;
  cachedInputPricePerMillion: number;
  outputPricePerMillion: number;
}

interface ExistingPricingRow {
  model_id: string;
  input_price_per_million: number | null;
  output_price_per_million: number | null;
  cached_input_price_per_million: number | null;
  source: string | null;
  effective_date: string;
}

const OPENAI_PRICING_DOCUMENTS: OfficialPricingDefinition[] = [
  {
    provider: "OpenAI",
    modelSlugs: ["openai-gpt-5-6-sol", "openai-gpt-5-6"],
    documentUrl:
      "https://developers.openai.com/api/docs/models/gpt-5.6-sol.md",
    sourceUrl: "https://developers.openai.com/api/docs/models/gpt-5.6-sol",
  },
  {
    provider: "OpenAI",
    modelSlugs: ["openai-gpt-5-6-terra"],
    documentUrl:
      "https://developers.openai.com/api/docs/models/gpt-5.6-terra.md",
    sourceUrl: "https://developers.openai.com/api/docs/models/gpt-5.6-terra",
  },
  {
    provider: "OpenAI",
    modelSlugs: ["openai-gpt-5-6-luna"],
    documentUrl:
      "https://developers.openai.com/api/docs/models/gpt-5.6-luna.md",
    sourceUrl: "https://developers.openai.com/api/docs/models/gpt-5.6-luna",
  },
];

function parsePrice(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function extractMetricPrice(markdown: string, metric: string): number | null {
  const escapedMetric = metric.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(
    new RegExp(
      `^\\|\\s*${escapedMetric}\\s*\\|\\s*\\$([\\d,.]+)\\s*\\|\\s*1M tokens\\s*\\|\\s*$`,
      "im"
    )
  );
  return parsePrice(match?.[1]);
}

export function parseOfficialTokenPricing(
  markdown: string
): ParsedTokenPricing | null {
  const inputPricePerMillion = extractMetricPrice(markdown, "Input");
  const cachedInputPricePerMillion = extractMetricPrice(
    markdown,
    "Cached input"
  );
  const outputPricePerMillion = extractMetricPrice(markdown, "Output");

  if (
    inputPricePerMillion === null ||
    cachedInputPricePerMillion === null ||
    outputPricePerMillion === null
  ) {
    return null;
  }

  return {
    inputPricePerMillion,
    cachedInputPricePerMillion,
    outputPricePerMillion,
  };
}

async function fetchOfficialPricing(
  definition: OfficialPricingDefinition,
  signal?: AbortSignal
): Promise<ParsedTokenPricing> {
  const response = await fetch(definition.documentUrl, {
    headers: { Accept: "text/markdown" },
    signal,
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const pricing = parseOfficialTokenPricing(await response.text());
  if (!pricing) {
    throw new Error("Official pricing table was not found");
  }
  return pricing;
}

function sameObservedPrice(
  existing: ExistingPricingRow | undefined,
  pricing: ParsedTokenPricing,
  sourceUrl: string
): boolean {
  return (
    Number(existing?.input_price_per_million) ===
      pricing.inputPricePerMillion &&
    Number(existing?.output_price_per_million) ===
      pricing.outputPricePerMillion &&
    Number(existing?.cached_input_price_per_million) ===
      pricing.cachedInputPricePerMillion &&
    existing?.source === sourceUrl
  );
}

const adapter: DataSourceAdapter = {
  id: "official-provider-pricing",
  name: "Official Provider Pricing",
  outputTypes: ["pricing"],
  defaultConfig: {},
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const now = new Date().toISOString();
    const effectiveDate = now.slice(0, 10);
    const errors: SyncResult["errors"] = [];
    const fetched = await Promise.all(
      OPENAI_PRICING_DOCUMENTS.map(async (definition) => {
        try {
          return {
            definition,
            pricing: await fetchOfficialPricing(definition, ctx.signal),
          };
        } catch (error) {
          errors.push({
            message: error instanceof Error ? error.message : String(error),
            context: definition.documentUrl,
          });
          return null;
        }
      })
    );
    const documents = fetched.filter(
      (
        result
      ): result is {
        definition: OfficialPricingDefinition;
        pricing: ParsedTokenPricing;
      } => Boolean(result)
    );

    const targetSlugs = documents.flatMap(
      ({ definition }) => definition.modelSlugs
    );
    const { data: models, error: modelsError } = await ctx.supabase
      .from("models")
      .select("id, slug")
      .in("slug", targetSlugs);

    if (modelsError) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [
          ...errors,
          { message: modelsError.message, context: "models lookup" },
        ],
      };
    }

    const modelBySlug = new Map(
      (models ?? []).map((model) => [model.slug, model])
    );
    const modelIds = (models ?? []).map((model) => model.id);
    const { data: existingRows, error: existingRowsError } =
      modelIds.length > 0
        ? await ctx.supabase
            .from("model_pricing")
            .select(
              "model_id, input_price_per_million, output_price_per_million, cached_input_price_per_million, source, effective_date"
            )
            .in("model_id", modelIds)
            .eq("provider_name", "OpenAI")
        : { data: [], error: null };

    if (existingRowsError) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [
          ...errors,
          {
            message: existingRowsError.message,
            context: "existing pricing lookup",
          },
        ],
      };
    }

    const existingByModelId = new Map(
      (existingRows ?? []).map((row) => [
        row.model_id,
        row as ExistingPricingRow,
      ])
    );
    let recordsProcessed = 0;
    let recordsCreated = 0;
    let recordsUpdated = 0;

    for (const { definition, pricing } of documents) {
      const matchedModels = definition.modelSlugs
        .map((slug) => modelBySlug.get(slug))
        .filter((model): model is NonNullable<typeof model> => Boolean(model));

      if (matchedModels.length === 0) {
        errors.push({
          message: "No matching active model row",
          context: definition.modelSlugs.join(", "),
        });
        continue;
      }

      for (const model of matchedModels) {
        recordsProcessed++;
        const existing = existingByModelId.get(model.id);
        const rowEffectiveDate = sameObservedPrice(
          existing,
          pricing,
          definition.sourceUrl
        )
          ? existing?.effective_date ?? effectiveDate
          : effectiveDate;
        const { error } = await ctx.supabase.from("model_pricing").upsert(
          {
            model_id: model.id,
            provider_name: definition.provider,
            pricing_model: "token_based",
            input_price_per_million: pricing.inputPricePerMillion,
            output_price_per_million: pricing.outputPricePerMillion,
            cached_input_price_per_million:
              pricing.cachedInputPricePerMillion,
            blended_price_per_million:
              pricing.inputPricePerMillion * 0.6 +
              pricing.outputPricePerMillion * 0.4,
            effective_date: rowEffectiveDate,
            source: definition.sourceUrl,
            updated_at: now,
          },
          { onConflict: "model_id,provider_name" }
        );

        if (error) {
          errors.push({
            message: error.message,
            context: `${definition.provider}/${model.slug}`,
          });
        } else if (existing) {
          recordsUpdated++;
        } else {
          recordsCreated++;
        }
      }
    }

    return {
      success: errors.length === 0,
      recordsProcessed,
      recordsCreated,
      recordsUpdated,
      errors,
      metadata: {
        documentsParsed: documents.length,
        documentsExpected: OPENAI_PRICING_DOCUMENTS.length,
      },
    };
  },

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const sentinel =
        OPENAI_PRICING_DOCUMENTS[OPENAI_PRICING_DOCUMENTS.length - 1];
      await fetchOfficialPricing(sentinel, controller.signal);

      return {
        healthy: true,
        latencyMs: Date.now() - start,
        message: "Official OpenAI pricing page parsed",
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : String(error),
      };
    } finally {
      clearTimeout(timeout);
    }
  },
};

registerAdapter(adapter);
export default adapter;

export const __testables = {
  extractMetricPrice,
  sameObservedPrice,
};
