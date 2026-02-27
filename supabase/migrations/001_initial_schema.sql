-- AI Market Cap: Initial Schema
-- Creates core tables for model catalog, benchmarks, rankings, pricing, and updates

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE model_category AS ENUM (
  'llm', 'image_generation', 'vision', 'multimodal',
  'embeddings', 'speech_audio', 'video', 'code', 'specialized'
);

CREATE TYPE model_status AS ENUM (
  'active', 'deprecated', 'beta', 'preview', 'archived'
);

CREATE TYPE license_type AS ENUM (
  'open_source', 'commercial', 'research_only', 'custom'
);

CREATE TYPE pricing_model_type AS ENUM (
  'token_based', 'per_api_call', 'per_gpu_second',
  'subscription', 'credit_based', 'free', 'custom'
);

-- ============================================================
-- MODELS (Core catalog)
-- ============================================================

CREATE TABLE models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  provider text NOT NULL,
  category model_category NOT NULL,
  status model_status DEFAULT 'active',

  -- Descriptive
  description text,
  short_description text,
  architecture text,
  parameter_count bigint,
  context_window integer,
  training_data_cutoff date,
  release_date date,

  -- External references
  hf_model_id text,
  hf_downloads bigint DEFAULT 0,
  hf_likes integer DEFAULT 0,
  hf_trending_score numeric(10,4),
  arxiv_paper_id text,
  website_url text,
  github_url text,

  -- License & access
  license license_type DEFAULT 'commercial',
  license_name text,
  is_open_weights boolean DEFAULT false,
  is_api_available boolean DEFAULT false,

  -- Capabilities (JSONB for flexibility)
  supported_languages jsonb DEFAULT '[]',
  modalities jsonb DEFAULT '[]',
  capabilities jsonb DEFAULT '{}',

  -- Computed/cached scores
  overall_rank integer,
  popularity_score numeric(10,4),
  quality_score numeric(10,4),
  value_score numeric(10,4),

  -- Full-text search
  fts tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(provider, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(architecture, '')), 'C')
  ) STORED,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  data_refreshed_at timestamptz
);

CREATE INDEX idx_models_slug ON models (slug);
CREATE INDEX idx_models_category ON models (category);
CREATE INDEX idx_models_provider ON models (provider);
CREATE INDEX idx_models_status ON models (status);
CREATE INDEX idx_models_overall_rank ON models (overall_rank) WHERE status = 'active';
CREATE INDEX idx_models_popularity ON models (popularity_score DESC NULLS LAST);
CREATE INDEX idx_models_release_date ON models (release_date DESC NULLS LAST);
CREATE INDEX idx_models_fts ON models USING gin (fts);
CREATE INDEX idx_models_hf_downloads ON models (hf_downloads DESC NULLS LAST);
CREATE INDEX idx_models_hf_model_id ON models (hf_model_id);

-- ============================================================
-- TAGS
-- ============================================================

CREATE TABLE tags (
  id serial PRIMARY KEY,
  name text UNIQUE NOT NULL,
  slug text UNIQUE NOT NULL,
  tag_group text
);

CREATE TABLE model_tags (
  model_id uuid REFERENCES models(id) ON DELETE CASCADE,
  tag_id integer REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (model_id, tag_id)
);

CREATE INDEX idx_model_tags_tag ON model_tags (tag_id);

-- ============================================================
-- MODEL VERSIONS
-- ============================================================

CREATE TABLE model_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  version_name text NOT NULL,
  release_date date,
  parameter_count bigint,
  context_window integer,
  is_current boolean DEFAULT true,
  changelog text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_model_versions_model ON model_versions (model_id);

-- ============================================================
-- BENCHMARKS & SCORES
-- ============================================================

CREATE TABLE benchmarks (
  id serial PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  category text,
  score_type text DEFAULT 'percentage',
  min_score numeric,
  max_score numeric,
  higher_is_better boolean DEFAULT true,
  source text,
  source_url text,
  is_active boolean DEFAULT true
);

CREATE TABLE benchmark_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  benchmark_id integer NOT NULL REFERENCES benchmarks(id) ON DELETE CASCADE,
  score numeric(12,4) NOT NULL,
  score_normalized numeric(5,4),
  evaluation_date date,
  model_version text,
  source text,
  source_url text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(model_id, benchmark_id, model_version)
);

CREATE INDEX idx_benchmark_scores_model ON benchmark_scores (model_id);
CREATE INDEX idx_benchmark_scores_benchmark ON benchmark_scores (benchmark_id);
CREATE INDEX idx_benchmark_scores_score ON benchmark_scores (benchmark_id, score DESC);

-- ============================================================
-- ELO RATINGS
-- ============================================================

CREATE TABLE elo_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  arena_name text NOT NULL DEFAULT 'chatbot_arena',
  elo_score integer NOT NULL,
  confidence_interval_low integer,
  confidence_interval_high integer,
  num_battles integer,
  rank integer,
  snapshot_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(model_id, arena_name, snapshot_date)
);

CREATE INDEX idx_elo_ratings_model ON elo_ratings (model_id);
CREATE INDEX idx_elo_ratings_arena_date ON elo_ratings (arena_name, snapshot_date DESC);

-- ============================================================
-- RANKINGS (computed/cached)
-- ============================================================

CREATE TABLE rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  ranking_type text NOT NULL,
  rank integer NOT NULL,
  score numeric(12,4),
  previous_rank integer,
  computed_at timestamptz DEFAULT now(),
  UNIQUE(model_id, ranking_type)
);

CREATE INDEX idx_rankings_type_rank ON rankings (ranking_type, rank);
CREATE INDEX idx_rankings_model ON rankings (model_id);

-- ============================================================
-- MODEL PRICING
-- ============================================================

CREATE TABLE model_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  provider_name text NOT NULL,
  pricing_model pricing_model_type NOT NULL,

  -- Token-based
  input_price_per_million numeric(12,6),
  output_price_per_million numeric(12,6),
  cached_input_price_per_million numeric(12,6),

  -- Alternative pricing
  price_per_call numeric(12,6),
  price_per_gpu_second numeric(12,6),
  subscription_monthly numeric(12,2),
  credits_per_dollar numeric(12,4),

  -- Performance
  median_output_tokens_per_second numeric(10,2),
  median_time_to_first_token numeric(10,4),
  uptime_percentage numeric(5,2),

  -- Blended
  blended_price_per_million numeric(12,6),

  currency text DEFAULT 'USD',
  is_free_tier boolean DEFAULT false,
  free_tier_limits jsonb,
  effective_date date DEFAULT CURRENT_DATE,
  source text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_model_pricing_model ON model_pricing (model_id);
CREATE INDEX idx_model_pricing_provider ON model_pricing (provider_name);

-- ============================================================
-- MODEL UPDATES (changelog/feed)
-- ============================================================

CREATE TABLE model_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  update_type text NOT NULL,
  title text NOT NULL,
  description text,
  old_value jsonb,
  new_value jsonb,
  source_url text,
  published_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_model_updates_model ON model_updates (model_id);
CREATE INDEX idx_model_updates_published ON model_updates (published_at DESC);
CREATE INDEX idx_model_updates_type ON model_updates (update_type);

-- ============================================================
-- SYNC JOBS (data pipeline tracking)
-- ============================================================

CREATE TABLE sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  job_type text NOT NULL,
  status text DEFAULT 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  records_processed integer DEFAULT 0,
  records_created integer DEFAULT 0,
  records_updated integer DEFAULT 0,
  error_message text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_sync_jobs_source ON sync_jobs (source, created_at DESC);
CREATE INDEX idx_sync_jobs_status ON sync_jobs (status);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Models are viewable by everyone" ON models FOR SELECT USING (true);

ALTER TABLE benchmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Benchmarks are viewable by everyone" ON benchmarks FOR SELECT USING (true);

ALTER TABLE benchmark_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scores are viewable by everyone" ON benchmark_scores FOR SELECT USING (true);

ALTER TABLE elo_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Elo ratings are viewable by everyone" ON elo_ratings FOR SELECT USING (true);

ALTER TABLE rankings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rankings are viewable by everyone" ON rankings FOR SELECT USING (true);

ALTER TABLE model_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pricing is viewable by everyone" ON model_pricing FOR SELECT USING (true);

ALTER TABLE model_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Updates are viewable by everyone" ON model_updates FOR SELECT USING (true);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tags are viewable by everyone" ON tags FOR SELECT USING (true);

ALTER TABLE model_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Model tags are viewable by everyone" ON model_tags FOR SELECT USING (true);

ALTER TABLE model_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Versions are viewable by everyone" ON model_versions FOR SELECT USING (true);

ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;
-- sync_jobs are NOT publicly readable — only service role

-- ============================================================
-- SEED BENCHMARK DEFINITIONS
-- ============================================================

INSERT INTO benchmarks (slug, name, description, category, score_type, min_score, max_score, higher_is_better, source) VALUES
  ('mmlu', 'MMLU', 'Massive Multitask Language Understanding — 57 subjects', 'knowledge', 'percentage', 0, 100, true, 'open_llm_leaderboard'),
  ('humaneval', 'HumanEval', 'Programming problems — pass@1 rate', 'coding', 'pass_rate', 0, 100, true, 'open_llm_leaderboard'),
  ('math', 'MATH', 'Mathematical problem-solving benchmark', 'math', 'percentage', 0, 100, true, 'open_llm_leaderboard'),
  ('gpqa', 'GPQA', 'Graduate-level advanced reasoning', 'reasoning', 'percentage', 0, 100, true, 'open_llm_leaderboard'),
  ('bbh', 'BBH', 'Big Bench Hard — 23 challenging reasoning tasks', 'reasoning', 'percentage', 0, 100, true, 'open_llm_leaderboard'),
  ('hellaswag', 'HellaSwag', 'Commonsense reasoning benchmark', 'reasoning', 'percentage', 0, 100, true, 'open_llm_leaderboard'),
  ('arc', 'ARC', 'AI2 Reasoning Challenge', 'reasoning', 'percentage', 0, 100, true, 'open_llm_leaderboard'),
  ('truthfulqa', 'TruthfulQA', 'Factual accuracy and truthfulness', 'safety', 'percentage', 0, 100, true, 'open_llm_leaderboard'),
  ('ifeval', 'IFEval', 'Instruction following evaluation', 'general', 'percentage', 0, 100, true, 'open_llm_leaderboard'),
  ('swe_bench', 'SWE-Bench', 'Software engineering challenges', 'coding', 'percentage', 0, 100, true, 'independent'),
  ('chatbot_arena_elo', 'Chatbot Arena Elo', 'Crowdsourced human preference Elo rating', 'general', 'elo', 800, 2000, true, 'lmsys');

-- ============================================================
-- HELPER: updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER models_updated_at BEFORE UPDATE ON models
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER benchmark_scores_updated_at BEFORE UPDATE ON benchmark_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER model_pricing_updated_at BEFORE UPDATE ON model_pricing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
