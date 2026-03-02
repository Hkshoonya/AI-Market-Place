-- Multi-Lens Scoring: add score + rank columns per lens

-- New lens columns on models
ALTER TABLE models ADD COLUMN IF NOT EXISTS capability_score NUMERIC;
ALTER TABLE models ADD COLUMN IF NOT EXISTS capability_rank INT;
ALTER TABLE models ADD COLUMN IF NOT EXISTS usage_score NUMERIC;
ALTER TABLE models ADD COLUMN IF NOT EXISTS usage_rank INT;
ALTER TABLE models ADD COLUMN IF NOT EXISTS expert_score NUMERIC;
ALTER TABLE models ADD COLUMN IF NOT EXISTS expert_rank INT;
ALTER TABLE models ADD COLUMN IF NOT EXISTS balanced_rank INT;

-- Indexes for sorting by each lens
CREATE INDEX IF NOT EXISTS idx_models_capability_rank ON models (capability_rank) WHERE capability_rank IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_models_usage_rank ON models (usage_rank) WHERE usage_rank IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_models_expert_rank ON models (expert_rank) WHERE expert_rank IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_models_balanced_rank ON models (balanced_rank) WHERE balanced_rank IS NOT NULL;

-- New snapshot columns for trend tracking
ALTER TABLE model_snapshots ADD COLUMN IF NOT EXISTS capability_score NUMERIC;
ALTER TABLE model_snapshots ADD COLUMN IF NOT EXISTS usage_score NUMERIC;
ALTER TABLE model_snapshots ADD COLUMN IF NOT EXISTS expert_score NUMERIC;
ALTER TABLE model_snapshots ADD COLUMN IF NOT EXISTS signal_coverage JSONB;

-- Pipeline health table
CREATE TABLE IF NOT EXISTS pipeline_health (
  source_slug TEXT PRIMARY KEY,
  last_success_at TIMESTAMPTZ,
  consecutive_failures INT DEFAULT 0,
  expected_interval_hours INT NOT NULL DEFAULT 6,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed pipeline_health from existing data_sources
INSERT INTO pipeline_health (source_slug, last_success_at, expected_interval_hours)
SELECT slug, last_sync_at, sync_interval_hours
FROM data_sources
WHERE is_enabled = true
ON CONFLICT (source_slug) DO NOTHING;
