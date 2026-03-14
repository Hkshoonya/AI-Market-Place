// Derived from database.ts interfaces (Model, BenchmarkScore, ModelPricing, EloRating, Ranking)
import { z } from "zod";

// ── Base Schema: Model ──────────────────────────────────────────────────
// Matches the Model interface in src/types/database.ts.
// Uses .nullable() for NULL columns, NOT .optional().
// Allows extra fields by Zod 4 default (no .strict()).

export const ModelBaseSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  provider: z.string(),
  category: z.string(),
  status: z.string(),
  description: z.string().nullable(),
  short_description: z.string().nullable(),
  architecture: z.string().nullable(),
  parameter_count: z.coerce.number().nullable(),
  context_window: z.coerce.number().nullable(),
  training_data_cutoff: z.string().nullable(),
  release_date: z.string().nullable(),
  hf_model_id: z.string().nullable(),
  hf_downloads: z.coerce.number(),
  hf_likes: z.coerce.number(),
  hf_trending_score: z.coerce.number().nullable(),
  arxiv_paper_id: z.string().nullable(),
  website_url: z.string().nullable(),
  github_url: z.string().nullable(),
  license: z.string().nullable(),
  license_name: z.string().nullable(),
  is_open_weights: z.boolean().nullable(),
  is_api_available: z.boolean(),
  supported_languages: z.array(z.string()),
  modalities: z.array(z.string()),
  capabilities: z.record(z.string(), z.boolean()),
  provider_id: z.coerce.number().nullable(),
  overall_rank: z.coerce.number().nullable(),
  popularity_score: z.coerce.number().nullable(),
  adoption_score: z.coerce.number().nullable(),
  quality_score: z.coerce.number().nullable(),
  value_score: z.coerce.number().nullable(),
  economic_footprint_score: z.coerce.number().nullable(),
  market_cap_estimate: z.coerce.number().nullable(),
  popularity_rank: z.coerce.number().nullable(),
  adoption_rank: z.coerce.number().nullable(),
  github_stars: z.coerce.number().nullable(),
  github_forks: z.coerce.number().nullable(),
  agent_score: z.coerce.number().nullable(),
  agent_rank: z.coerce.number().nullable(),
  capability_score: z.coerce.number().nullable(),
  capability_rank: z.coerce.number().nullable(),
  economic_footprint_rank: z.coerce.number().nullable(),
  usage_score: z.coerce.number().nullable(),
  usage_rank: z.coerce.number().nullable(),
  expert_score: z.coerce.number().nullable(),
  expert_rank: z.coerce.number().nullable(),
  balanced_rank: z.coerce.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  data_refreshed_at: z.string().nullable(),
});

export type ModelBase = z.infer<typeof ModelBaseSchema>;

// ── Base Schema: BenchmarkScore ─────────────────────────────────────────

export const BenchmarkScoreSchema = z.object({
  id: z.string(),
  model_id: z.string(),
  benchmark_id: z.coerce.number(),
  score: z.coerce.number(),
  score_normalized: z.coerce.number().nullable(),
  evaluation_date: z.string().nullable(),
  model_version: z.string().nullable(),
  source: z.string().nullable(),
  source_url: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  created_at: z.string(),
  updated_at: z.string(),
});

export type BenchmarkScoreType = z.infer<typeof BenchmarkScoreSchema>;

// ── Base Schema: ModelPricing ───────────────────────────────────────────

export const ModelPricingSchema = z.object({
  id: z.string(),
  model_id: z.string(),
  provider_name: z.string(),
  pricing_model: z.string(),
  input_price_per_million: z.coerce.number().nullable(),
  output_price_per_million: z.coerce.number().nullable(),
  cached_input_price_per_million: z.coerce.number().nullable(),
  price_per_call: z.coerce.number().nullable(),
  price_per_gpu_second: z.coerce.number().nullable(),
  subscription_monthly: z.coerce.number().nullable(),
  credits_per_dollar: z.coerce.number().nullable(),
  median_output_tokens_per_second: z.coerce.number().nullable(),
  median_time_to_first_token: z.coerce.number().nullable(),
  uptime_percentage: z.coerce.number().nullable(),
  blended_price_per_million: z.coerce.number().nullable(),
  currency: z.string(),
  is_free_tier: z.boolean(),
  free_tier_limits: z.record(z.string(), z.unknown()).nullable(),
  effective_date: z.string(),
  source: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type ModelPricingType = z.infer<typeof ModelPricingSchema>;

// ── Base Schema: EloRating ──────────────────────────────────────────────

export const EloRatingSchema = z.object({
  id: z.string(),
  model_id: z.string(),
  arena_name: z.string(),
  elo_score: z.coerce.number(),
  confidence_interval_low: z.coerce.number().nullable(),
  confidence_interval_high: z.coerce.number().nullable(),
  num_battles: z.coerce.number().nullable(),
  rank: z.coerce.number().nullable(),
  snapshot_date: z.string(),
  created_at: z.string(),
});

export type EloRatingType = z.infer<typeof EloRatingSchema>;

// ── Base Schema: Ranking ────────────────────────────────────────────────

export const RankingSchema = z.object({
  id: z.string(),
  model_id: z.string(),
  ranking_type: z.string(),
  rank: z.coerce.number(),
  score: z.coerce.number().nullable(),
  previous_rank: z.coerce.number().nullable(),
  computed_at: z.string(),
});

export type RankingType = z.infer<typeof RankingSchema>;

// ── Query-Specific Schemas ──────────────────────────────────────────────

// Home page top models (src/app/page.tsx)
export const HomeTopModelSchema = ModelBaseSchema.pick({
  id: true,
  slug: true,
  name: true,
  provider: true,
  category: true,
  overall_rank: true,
  quality_score: true,
  economic_footprint_score: true,
  market_cap_estimate: true,
  popularity_score: true,
  adoption_score: true,
  agent_score: true,
  is_open_weights: true,
}).extend({
  rankings: z.array(RankingSchema.partial()).optional(),
  model_pricing: z.array(ModelPricingSchema.partial()).optional(),
  benchmark_scores: z.array(BenchmarkScoreSchema.partial().extend({
    benchmarks: z.object({
      slug: z.string().nullable().optional(),
    }).nullable().optional(),
  })).optional(),
  elo_ratings: z.array(EloRatingSchema.partial()).optional(),
});

export type HomeTopModel = z.infer<typeof HomeTopModelSchema>;

// Explorer models (src/app/(rankings)/leaderboards/page.tsx explorer query)
export const ExplorerModelSchema = z.object({
  name: z.string(),
  slug: z.string(),
  provider: z.string(),
  category: z.string(),
  status: z.string(),
  overall_rank: z.coerce.number().nullable(),
  category_rank: z.coerce.number().nullable(),
  quality_score: z.coerce.number().nullable(),
  value_score: z.coerce.number().nullable(),
  is_open_weights: z.boolean().nullable(),
  hf_downloads: z.coerce.number().nullable(),
  popularity_score: z.coerce.number().nullable(),
  adoption_score: z.coerce.number().nullable(),
  adoption_rank: z.coerce.number().nullable(),
  agent_score: z.coerce.number().nullable(),
  agent_rank: z.coerce.number().nullable(),
  popularity_rank: z.coerce.number().nullable(),
  economic_footprint_score: z.coerce.number().nullable(),
  economic_footprint_rank: z.coerce.number().nullable(),
  market_cap_estimate: z.coerce.number().nullable(),
  capability_score: z.coerce.number().nullable(),
  capability_rank: z.coerce.number().nullable(),
  usage_score: z.coerce.number().nullable(),
  usage_rank: z.coerce.number().nullable(),
  expert_score: z.coerce.number().nullable(),
  expert_rank: z.coerce.number().nullable(),
  balanced_rank: z.coerce.number().nullable(),
});

export type ExplorerModel = z.infer<typeof ExplorerModelSchema>;

// Model detail page (src/app/(catalog)/models/[slug]/page.tsx)
// Full model + all relation joins from the detail query
export const ModelWithDetailsSchema = ModelBaseSchema.extend({
  benchmark_scores: z.array(BenchmarkScoreSchema.partial().extend({
    benchmarks: z.object({
      name: z.string(),
      slug: z.string(),
      category: z.string(),
      max_score: z.coerce.number().nullable(),
    }).nullable().optional(),
  })).optional(),
  model_pricing: z.array(ModelPricingSchema.partial()).optional(),
  elo_ratings: z.array(EloRatingSchema.partial()).optional(),
  rankings: z.array(RankingSchema.partial()).optional(),
  model_updates: z.array(z.object({
    title: z.string(),
    description: z.string().nullable(),
    update_type: z.string(),
    published_at: z.string(),
  }).partial()).optional(),
});

export type ModelWithDetailsType = z.infer<typeof ModelWithDetailsSchema>;
