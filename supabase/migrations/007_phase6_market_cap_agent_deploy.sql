-- 007_phase6_market_cap_agent_deploy.sql
-- Phase 6: Market Cap, Agent Score, Deploy Tab, Model Descriptions

-- 1. Add market cap + popularity columns to models
ALTER TABLE models ADD COLUMN IF NOT EXISTS market_cap_estimate numeric;
ALTER TABLE models ADD COLUMN IF NOT EXISTS popularity_rank integer;
ALTER TABLE models ADD COLUMN IF NOT EXISTS github_stars integer;
ALTER TABLE models ADD COLUMN IF NOT EXISTS github_forks integer;
ALTER TABLE models ADD COLUMN IF NOT EXISTS agent_score numeric;
ALTER TABLE models ADD COLUMN IF NOT EXISTS agent_rank integer;

-- 2. Add to model_snapshots for historical tracking
ALTER TABLE model_snapshots ADD COLUMN IF NOT EXISTS market_cap_estimate numeric;
ALTER TABLE model_snapshots ADD COLUMN IF NOT EXISTS popularity_score numeric;
ALTER TABLE model_snapshots ADD COLUMN IF NOT EXISTS agent_score numeric;

-- 3. Deployment platforms table
CREATE TABLE IF NOT EXISTS deployment_platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  logo_url text,
  type text NOT NULL CHECK (type IN ('api', 'hosting', 'subscription', 'self-hosted', 'local')),
  affiliate_url_template text,
  has_affiliate boolean DEFAULT false,
  affiliate_commission text,
  base_url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Model deployments (which models are on which platforms)
CREATE TABLE IF NOT EXISTS model_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  platform_id uuid NOT NULL REFERENCES deployment_platforms(id) ON DELETE CASCADE,
  deploy_url text,
  pricing_model text CHECK (pricing_model IN ('per-token', 'per-second', 'monthly', 'free')),
  price_per_unit numeric,
  unit_description text,
  free_tier text,
  one_click boolean DEFAULT false,
  status text DEFAULT 'available' CHECK (status IN ('available', 'coming_soon', 'deprecated')),
  last_price_check timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(model_id, platform_id)
);

-- 5. Model descriptions (AI-generated + community)
CREATE TABLE IF NOT EXISTS model_descriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid UNIQUE NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  summary text,
  pros jsonb DEFAULT '[]'::jsonb,
  cons jsonb DEFAULT '[]'::jsonb,
  best_for text[] DEFAULT '{}',
  not_ideal_for text[] DEFAULT '{}',
  comparison_notes text,
  generated_by text DEFAULT 'ai' CHECK (generated_by IN ('ai', 'community', 'curated')),
  last_generated timestamptz DEFAULT now(),
  upvotes integer DEFAULT 0,
  downvotes integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 6. Add benchmark definitions for agent score benchmarks
INSERT INTO benchmarks (slug, name, description, category, score_type, min_score, max_score, higher_is_better, source)
VALUES
  ('swe-bench-verified', 'SWE-Bench Verified', 'Verified GitHub issue fixing benchmark', 'code', 'percentage', 0, 100, true, 'swe-bench'),
  ('terminal-bench', 'TerminalBench 2.0', 'Terminal/CLI agent task benchmark', 'code', 'percentage', 0, 100, true, 'terminal-bench'),
  ('os-world', 'OSWorld', 'Desktop GUI agent task benchmark', 'multimodal', 'percentage', 0, 100, true, 'osworld'),
  ('gaia', 'GAIA', 'Real-world assistant task benchmark', 'reasoning', 'percentage', 0, 100, true, 'gaia'),
  ('webarena', 'WebArena', 'Web browsing agent task benchmark', 'reasoning', 'percentage', 0, 100, true, 'webarena'),
  ('aider-polyglot', 'Aider Polyglot', 'Multi-language code editing benchmark', 'code', 'percentage', 0, 100, true, 'aider'),
  ('tau-bench', 'TAU-Bench', 'Tool-augmented understanding benchmark', 'reasoning', 'percentage', 0, 100, true, 'tau-bench'),
  ('agent-bench', 'AgentBench', 'Multi-environment agent evaluation', 'reasoning', 'percentage', 0, 100, true, 'agent-bench')
ON CONFLICT (slug) DO NOTHING;

-- 7. Seed deployment platforms
INSERT INTO deployment_platforms (slug, name, type, base_url, has_affiliate, affiliate_commission) VALUES
  ('openrouter', 'OpenRouter', 'api', 'https://openrouter.ai', false, null),
  ('openai-api', 'OpenAI API', 'api', 'https://platform.openai.com', false, null),
  ('anthropic-api', 'Anthropic API', 'api', 'https://console.anthropic.com', false, null),
  ('google-ai-studio', 'Google AI Studio', 'api', 'https://aistudio.google.com', false, null),
  ('groq', 'Groq', 'api', 'https://console.groq.com', false, null),
  ('cerebras', 'Cerebras', 'api', 'https://cloud.cerebras.ai', false, null),
  ('fireworks', 'Fireworks AI', 'api', 'https://fireworks.ai', false, null),
  ('together-ai', 'Together AI', 'api', 'https://api.together.ai', false, null),
  ('deepinfra', 'DeepInfra', 'api', 'https://deepinfra.com', false, null),
  ('perplexity-api', 'Perplexity API', 'api', 'https://docs.perplexity.ai', true, '$15-20 per install'),
  ('mistral-api', 'Mistral API', 'api', 'https://console.mistral.ai', false, null),
  ('cohere', 'Cohere', 'api', 'https://dashboard.cohere.com', false, null),
  ('aws-bedrock', 'AWS Bedrock', 'hosting', 'https://aws.amazon.com/bedrock', false, null),
  ('azure-ai', 'Azure AI', 'hosting', 'https://ai.azure.com', false, null),
  ('gcp-vertex', 'GCP Vertex AI', 'hosting', 'https://cloud.google.com/vertex-ai', true, 'Cash per new user'),
  ('hf-inference', 'HuggingFace Inference', 'hosting', 'https://huggingface.co/inference-endpoints', false, null),
  ('replicate', 'Replicate', 'hosting', 'https://replicate.com', false, null),
  ('modal', 'Modal', 'hosting', 'https://modal.com', false, null),
  ('runpod', 'RunPod', 'self-hosted', 'https://runpod.io', true, 'Credits per referral'),
  ('lambda-cloud', 'Lambda Cloud', 'self-hosted', 'https://lambdalabs.com', false, null),
  ('vast-ai', 'Vast.ai', 'self-hosted', 'https://vast.ai', false, null),
  ('coreweave', 'CoreWeave', 'self-hosted', 'https://coreweave.com', false, null),
  ('ollama', 'Ollama', 'local', 'https://ollama.com', false, null),
  ('lm-studio', 'LM Studio', 'local', 'https://lmstudio.ai', false, null),
  ('llamacpp', 'llama.cpp', 'local', 'https://github.com/ggml-org/llama.cpp', false, null),
  ('chatgpt-plus', 'ChatGPT Plus', 'subscription', 'https://chat.openai.com', false, null),
  ('chatgpt-pro', 'ChatGPT Pro', 'subscription', 'https://chat.openai.com', false, null),
  ('claude-pro', 'Claude Pro', 'subscription', 'https://claude.ai', false, null),
  ('gemini-advanced', 'Gemini Advanced', 'subscription', 'https://gemini.google.com', false, null),
  ('perplexity-pro', 'Perplexity Pro', 'subscription', 'https://perplexity.ai', true, '$15-20 per install'),
  ('grok-premium', 'Grok Premium', 'subscription', 'https://x.com/i/grok', false, null)
ON CONFLICT (slug) DO NOTHING;

-- 8. Enable RLS
ALTER TABLE deployment_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_descriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read deployment_platforms" ON deployment_platforms FOR SELECT USING (true);
CREATE POLICY "Public read model_deployments" ON model_deployments FOR SELECT USING (true);
CREATE POLICY "Public read model_descriptions" ON model_descriptions FOR SELECT USING (true);

-- Service role can insert/update
CREATE POLICY "Service write deployment_platforms" ON deployment_platforms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write model_deployments" ON model_deployments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write model_descriptions" ON model_descriptions FOR ALL USING (true) WITH CHECK (true);
