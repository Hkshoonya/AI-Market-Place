import { describe, it, expect } from "vitest";
import {
  ModelBaseSchema,
  BenchmarkScoreSchema,
  ModelPricingSchema,
  EloRatingSchema,
  RankingSchema,
  HomeTopModelSchema,
  ExplorerModelSchema,
} from "./models";

// Realistic sample data matching the Model interface from database.ts
const validModel = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  slug: "gpt-4o",
  name: "GPT-4o",
  provider: "OpenAI",
  category: "llm",
  status: "active",
  description: "Multimodal large language model",
  short_description: "Advanced multimodal model",
  architecture: "Transformer",
  parameter_count: 200000000000,
  context_window: 128000,
  training_data_cutoff: "2024-10",
  release_date: "2024-05-13",
  hf_model_id: null,
  hf_downloads: 0,
  hf_likes: 0,
  hf_trending_score: null,
  arxiv_paper_id: null,
  website_url: "https://openai.com/gpt-4o",
  github_url: null,
  license: "commercial",
  license_name: null,
  is_open_weights: false,
  is_api_available: true,
  supported_languages: ["en", "es", "fr"],
  modalities: ["text", "image", "audio"],
  capabilities: { reasoning: true, coding: true, vision: true },
  provider_id: 1,
  overall_rank: 1,
  popularity_score: 95.5,
  quality_score: 92.3,
  value_score: 78.1,
  market_cap_estimate: 5200000,
  popularity_rank: 1,
  github_stars: null,
  github_forks: null,
  agent_score: 88.5,
  agent_rank: 2,
  capability_score: 91.0,
  capability_rank: 1,
  usage_score: 94.2,
  usage_rank: 1,
  expert_score: 89.7,
  expert_rank: 3,
  balanced_rank: 1,
  created_at: "2024-05-13T00:00:00Z",
  updated_at: "2024-12-01T12:00:00Z",
  data_refreshed_at: "2024-12-01T12:00:00Z",
};

describe("ModelBaseSchema", () => {
  it("validates a complete Model object from database", () => {
    const result = ModelBaseSchema.safeParse(validModel);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(validModel.id);
      expect(result.data.name).toBe("GPT-4o");
      expect(result.data.overall_rank).toBe(1);
    }
  });

  it("rejects missing required fields (id, slug, name)", () => {
    const incomplete = { provider: "OpenAI", category: "llm" };
    const result = ModelBaseSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it("accepts null for nullable fields (description, overall_rank, etc.)", () => {
    const withNulls = {
      ...validModel,
      description: null,
      short_description: null,
      architecture: null,
      parameter_count: null,
      context_window: null,
      overall_rank: null,
      quality_score: null,
      market_cap_estimate: null,
      popularity_score: null,
      agent_score: null,
      agent_rank: null,
      capability_score: null,
      capability_rank: null,
      usage_score: null,
      usage_rank: null,
      expert_score: null,
      expert_rank: null,
      balanced_rank: null,
      data_refreshed_at: null,
    };
    const result = ModelBaseSchema.safeParse(withNulls);
    expect(result.success).toBe(true);
  });

  it("allows extra fields from database (Zod 4 default passthrough)", () => {
    const withExtra = { ...validModel, new_column: "some value" };
    const result = ModelBaseSchema.safeParse(withExtra);
    expect(result.success).toBe(true);
  });

  it("coerces string numbers from PostgREST to actual numbers", () => {
    const withStringNumbers = {
      ...validModel,
      parameter_count: "200000000000",
      context_window: "128000",
      hf_downloads: "0",
      hf_likes: "0",
      overall_rank: "1",
      quality_score: "92.3",
      market_cap_estimate: "5200000",
      popularity_score: "95.5",
      provider_id: "1",
    };
    const result = ModelBaseSchema.safeParse(withStringNumbers);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parameter_count).toBe(200000000000);
      expect(result.data.quality_score).toBe(92.3);
      expect(typeof result.data.hf_downloads).toBe("number");
    }
  });

  it("accepts null is_open_weights from DB without NOT NULL constraint", () => {
    const withNullOpenWeights = { ...validModel, is_open_weights: null };
    const result = ModelBaseSchema.safeParse(withNullOpenWeights);
    expect(result.success).toBe(true);
  });
});

describe("Query-specific pick schemas", () => {
  it("HomeTopModelSchema validates home page model subset with relations", () => {
    const homeModel = {
      id: validModel.id,
      slug: validModel.slug,
      name: validModel.name,
      provider: validModel.provider,
      category: validModel.category,
      overall_rank: validModel.overall_rank,
      quality_score: validModel.quality_score,
      market_cap_estimate: validModel.market_cap_estimate,
      popularity_score: validModel.popularity_score,
      is_open_weights: validModel.is_open_weights,
      rankings: [{ balanced_rank: 1 }],
      model_pricing: [{ input_price_per_million: 2.5 }],
    };
    const result = HomeTopModelSchema.safeParse(homeModel);
    expect(result.success).toBe(true);
  });

  it("ExplorerModelSchema validates explorer model subset", () => {
    const explorerModel = {
      name: validModel.name,
      slug: validModel.slug,
      provider: validModel.provider,
      category: validModel.category,
      overall_rank: validModel.overall_rank,
      category_rank: 1,
      quality_score: validModel.quality_score,
      value_score: validModel.value_score,
      is_open_weights: validModel.is_open_weights,
      hf_downloads: validModel.hf_downloads,
      popularity_score: validModel.popularity_score,
      agent_score: validModel.agent_score,
      agent_rank: validModel.agent_rank,
      popularity_rank: validModel.popularity_rank,
      market_cap_estimate: validModel.market_cap_estimate,
      capability_score: validModel.capability_score,
      capability_rank: validModel.capability_rank,
      usage_score: validModel.usage_score,
      usage_rank: validModel.usage_rank,
      expert_score: validModel.expert_score,
      expert_rank: validModel.expert_rank,
      balanced_rank: validModel.balanced_rank,
    };
    const result = ExplorerModelSchema.safeParse(explorerModel);
    expect(result.success).toBe(true);
  });
});

describe("BenchmarkScoreSchema", () => {
  it("validates a complete benchmark score record", () => {
    const score = {
      id: "bs-001",
      model_id: validModel.id,
      benchmark_id: 1,
      score: 89.5,
      score_normalized: 92.1,
      evaluation_date: "2024-11-01",
      model_version: "v1.0",
      source: "official",
      source_url: "https://example.com",
      metadata: { notes: "evaluation run 1" },
      created_at: "2024-11-01T00:00:00Z",
      updated_at: "2024-11-02T00:00:00Z",
    };
    const result = BenchmarkScoreSchema.safeParse(score);
    expect(result.success).toBe(true);
  });
});

describe("ModelPricingSchema", () => {
  it("validates a complete pricing record", () => {
    const pricing = {
      id: "mp-001",
      model_id: validModel.id,
      provider_name: "OpenAI",
      pricing_model: "per_token",
      input_price_per_million: 2.5,
      output_price_per_million: 10.0,
      cached_input_price_per_million: null,
      price_per_call: null,
      price_per_gpu_second: null,
      subscription_monthly: null,
      credits_per_dollar: null,
      median_output_tokens_per_second: 85.3,
      median_time_to_first_token: 0.45,
      uptime_percentage: 99.9,
      blended_price_per_million: 6.25,
      currency: "USD",
      is_free_tier: false,
      free_tier_limits: null,
      effective_date: "2024-11-01",
      source: "official",
      created_at: "2024-11-01T00:00:00Z",
      updated_at: "2024-11-02T00:00:00Z",
    };
    const result = ModelPricingSchema.safeParse(pricing);
    expect(result.success).toBe(true);
  });
});

describe("EloRatingSchema", () => {
  it("validates a complete elo rating record", () => {
    const elo = {
      id: "elo-001",
      model_id: validModel.id,
      arena_name: "chatbot-arena",
      elo_score: 1250,
      confidence_interval_low: 1230,
      confidence_interval_high: 1270,
      num_battles: 5000,
      rank: 3,
      snapshot_date: "2024-11-01",
      created_at: "2024-11-01T00:00:00Z",
    };
    const result = EloRatingSchema.safeParse(elo);
    expect(result.success).toBe(true);
  });
});

describe("RankingSchema", () => {
  it("validates a complete ranking record", () => {
    const ranking = {
      id: "rank-001",
      model_id: validModel.id,
      ranking_type: "overall",
      rank: 1,
      score: 95.5,
      previous_rank: 2,
      computed_at: "2024-11-01T00:00:00Z",
    };
    const result = RankingSchema.safeParse(ranking);
    expect(result.success).toBe(true);
  });
});
