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
  parameter_count: z.number().nullable(),
  context_window: z.number().nullable(),
  training_data_cutoff: z.string().nullable(),
  release_date: z.string().nullable(),
  hf_model_id: z.string().nullable(),
  hf_downloads: z.number(),
  hf_likes: z.number(),
  hf_trending_score: z.number().nullable(),
  arxiv_paper_id: z.string().nullable(),
  website_url: z.string().nullable(),
  github_url: z.string().nullable(),
  license: z.string(),
  license_name: z.string().nullable(),
  is_open_weights: z.boolean(),
  is_api_available: z.boolean(),
  supported_languages: z.array(z.string()),
  modalities: z.array(z.string()),
  capabilities: z.record(z.string(), z.boolean()),
  provider_id: z.number().nullable(),
  overall_rank: z.number().nullable(),
  popularity_score: z.number().nullable(),
  quality_score: z.number().nullable(),
  value_score: z.number().nullable(),
  market_cap_estimate: z.number().nullable(),
  popularity_rank: z.number().nullable(),
  github_stars: z.number().nullable(),
  github_forks: z.number().nullable(),
  agent_score: z.number().nullable(),
  agent_rank: z.number().nullable(),
  capability_score: z.number().nullable(),
  capability_rank: z.number().nullable(),
  usage_score: z.number().nullable(),
  usage_rank: z.number().nullable(),
  expert_score: z.number().nullable(),
  expert_rank: z.number().nullable(),
  balanced_rank: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  data_refreshed_at: z.string().nullable(),
});

export type ModelBase = z.infer<typeof ModelBaseSchema>;

// ── Base Schema: BenchmarkScore ─────────────────────────────────────────

export const BenchmarkScoreSchema = z.object({
  id: z.string(),
  model_id: z.string(),
  benchmark_id: z.number(),
  score: z.number(),
  score_normalized: z.number().nullable(),
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
  input_price_per_million: z.number().nullable(),
  output_price_per_million: z.number().nullable(),
  cached_input_price_per_million: z.number().nullable(),
  price_per_call: z.number().nullable(),
  price_per_gpu_second: z.number().nullable(),
  subscription_monthly: z.number().nullable(),
  credits_per_dollar: z.number().nullable(),
  median_output_tokens_per_second: z.number().nullable(),
  median_time_to_first_token: z.number().nullable(),
  uptime_percentage: z.number().nullable(),
  blended_price_per_million: z.number().nullable(),
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
  elo_score: z.number(),
  confidence_interval_low: z.number().nullable(),
  confidence_interval_high: z.number().nullable(),
  num_battles: z.number().nullable(),
  rank: z.number().nullable(),
  snapshot_date: z.string(),
  created_at: z.string(),
});

export type EloRatingType = z.infer<typeof EloRatingSchema>;

// ── Base Schema: Ranking ────────────────────────────────────────────────

export const RankingSchema = z.object({
  id: z.string(),
  model_id: z.string(),
  ranking_type: z.string(),
  rank: z.number(),
  score: z.number().nullable(),
  previous_rank: z.number().nullable(),
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
  market_cap_estimate: true,
  popularity_score: true,
  is_open_weights: true,
}).extend({
  rankings: z.array(RankingSchema.partial()).optional(),
  model_pricing: z.array(ModelPricingSchema.partial()).optional(),
});

export type HomeTopModel = z.infer<typeof HomeTopModelSchema>;

// Explorer models (src/app/(rankings)/leaderboards/page.tsx explorer query)
export const ExplorerModelSchema = z.object({
  name: z.string(),
  slug: z.string(),
  provider: z.string(),
  category: z.string(),
  overall_rank: z.number().nullable(),
  category_rank: z.number().nullable(),
  quality_score: z.number().nullable(),
  value_score: z.number().nullable(),
  is_open_weights: z.boolean().nullable(),
  hf_downloads: z.number().nullable(),
  popularity_score: z.number().nullable(),
  agent_score: z.number().nullable(),
  agent_rank: z.number().nullable(),
  popularity_rank: z.number().nullable(),
  market_cap_estimate: z.number().nullable(),
  capability_score: z.number().nullable(),
  capability_rank: z.number().nullable(),
  usage_score: z.number().nullable(),
  usage_rank: z.number().nullable(),
  expert_score: z.number().nullable(),
  expert_rank: z.number().nullable(),
  balanced_rank: z.number().nullable(),
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
      max_score: z.number().nullable(),
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
