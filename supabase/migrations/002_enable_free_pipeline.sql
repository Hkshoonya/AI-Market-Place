-- Migration 002: Enable free pipeline data sources
-- Adds new zero-API-key data sources and normalises priorities so the
-- discovery tier runs in the correct order.

-- ─── 1. Add openrouter-models (free, no key required) ────────────────────────
INSERT INTO data_sources (
  slug, name, adapter_type, description,
  tier, sync_interval_hours, priority,
  secret_env_keys, output_types, config, is_enabled
)
VALUES (
  'openrouter-models',
  'OpenRouter Models',
  'openrouter-models',
  'Primary model discovery: 400+ models with pricing and metadata from OpenRouter free API',
  1, 6, 5,
  '{}',
  '{"models","pricing"}',
  '{}',
  true
)
ON CONFLICT (slug) DO NOTHING;

-- ─── 2. Add provider-news ─────────────────────────────────────────────────────
INSERT INTO data_sources (
  slug, name, adapter_type, description,
  tier, sync_interval_hours, priority,
  secret_env_keys, output_types, config, is_enabled
)
VALUES (
  'provider-news',
  'Provider News',
  'provider-news',
  'Scrapes AI company blogs for model announcements and updates',
  3, 24, 5,
  '{}',
  '{"news"}',
  '{}',
  true
)
ON CONFLICT (slug) DO NOTHING;

-- ─── 3. Add x-announcements ──────────────────────────────────────────────────
INSERT INTO data_sources (
  slug, name, adapter_type, description,
  tier, sync_interval_hours, priority,
  secret_env_keys, output_types, config, is_enabled
)
VALUES (
  'x-announcements',
  'X.com Model Announcements',
  'x-announcements',
  'Monitors AI company X/Twitter accounts for model announcements via RSS',
  3, 24, 15,
  '{}',
  '{"news"}',
  '{"maxTweetsPerAccount": 10}',
  true
)
ON CONFLICT (slug) DO NOTHING;

-- ─── 4. Clear API key requirements from existing adapters ────────────────────
-- These sources either have free tiers or scrape public data; no key needed.
UPDATE data_sources
SET secret_env_keys = '{}'
WHERE slug IN (
  'openai-models',
  'anthropic-models',
  'google-models',
  'replicate',
  'huggingface',
  'artificial-analysis',
  'civitai'
);

-- ─── 5. Ensure every data source is enabled ──────────────────────────────────
UPDATE data_sources SET is_enabled = true;

-- ─── 6. Reorder Tier 1 priorities (lowest number = runs first) ───────────────
-- openrouter-models is the primary discovery source and must run first so
-- downstream tiers have fresh model records to enrich.
UPDATE data_sources SET priority = 5  WHERE slug = 'openrouter-models';
UPDATE data_sources SET priority = 15 WHERE slug = 'huggingface';
UPDATE data_sources SET priority = 25 WHERE slug = 'openai-models';
UPDATE data_sources SET priority = 35 WHERE slug = 'anthropic-models';
UPDATE data_sources SET priority = 45 WHERE slug = 'google-models';
UPDATE data_sources SET priority = 55 WHERE slug = 'replicate';
