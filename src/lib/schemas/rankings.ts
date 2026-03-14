// Derived from inline types in leaderboards/page.tsx and [category]/page.tsx
import { z } from "zod";

// ── Ranked Model Schema (Top 20 leaderboard) ───────────────────────────
// From src/app/(rankings)/leaderboards/page.tsx RankedModel type
// Includes joined benchmark_scores, model_pricing relations

export const RankedModelSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  provider: z.string(),
  category: z.string(),
  overall_rank: z.coerce.number().nullable(),
  quality_score: z.coerce.number().nullable(),
  adoption_score: z.coerce.number().nullable(),
  economic_footprint_score: z.coerce.number().nullable(),
  market_cap_estimate: z.coerce.number().nullable(),
  popularity_score: z.coerce.number().nullable(),
  is_open_weights: z.boolean().nullable(),
  benchmark_scores: z.array(z.object({
    score_normalized: z.coerce.number(),
    benchmarks: z.object({
      slug: z.string(),
    }).nullable(),
  })),
  model_pricing: z.array(z.object({
    input_price_per_million: z.coerce.number().nullable(),
  })),
});

export type RankedModel = z.infer<typeof RankedModelSchema>;

// ── Speed Model Schema ──────────────────────────────────────────────────
// From leaderboards/page.tsx SpeedModel type (model_pricing with joined models)

export const SpeedModelSchema = z.object({
  id: z.string(),
  median_output_tokens_per_second: z.coerce.number().nullable(),
  median_time_to_first_token: z.coerce.number().nullable(),
  input_price_per_million: z.coerce.number().nullable(),
  provider_name: z.string().nullable(),
  models: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    provider: z.string(),
    category: z.string(),
    overall_rank: z.coerce.number().nullable(),
    quality_score: z.coerce.number().nullable(),
    is_open_weights: z.boolean().nullable(),
  }),
});

export type SpeedModel = z.infer<typeof SpeedModelSchema>;

// ── Value Model Schema ──────────────────────────────────────────────────
// From leaderboards/page.tsx ValueModel type

export const ValueModelSchema = z.object({
  id: z.string(),
  input_price_per_million: z.coerce.number().nullable(),
  output_price_per_million: z.coerce.number().nullable().optional(),
  provider_name: z.string().nullable(),
  models: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    provider: z.string(),
    category: z.string(),
    overall_rank: z.coerce.number().nullable(),
    quality_score: z.coerce.number().nullable(),
    is_open_weights: z.boolean().nullable(),
  }),
});

export type ValueModel = z.infer<typeof ValueModelSchema>;

// ── Category Model Schema ───────────────────────────────────────────────
// From leaderboards/[category]/page.tsx CategoryModel type

export const CategoryModelSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  provider: z.string(),
  category: z.string(),
  overall_rank: z.coerce.number().nullable(),
  category_rank: z.coerce.number().nullable(),
  quality_score: z.coerce.number().nullable(),
  is_open_weights: z.boolean().nullable(),
  parameter_count: z.coerce.number().nullable(),
  benchmark_scores: z.array(z.object({
    score_normalized: z.coerce.number().nullable(),
    benchmarks: z.object({
      slug: z.string(),
      name: z.string(),
    }).nullable(),
  })),
  model_pricing: z.array(z.object({
    input_price_per_million: z.coerce.number().nullable(),
    median_output_tokens_per_second: z.coerce.number().nullable(),
  })),
});

export type CategoryModel = z.infer<typeof CategoryModelSchema>;
