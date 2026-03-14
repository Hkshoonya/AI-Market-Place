ALTER TABLE models
  ADD COLUMN IF NOT EXISTS adoption_score NUMERIC,
  ADD COLUMN IF NOT EXISTS adoption_rank INTEGER,
  ADD COLUMN IF NOT EXISTS economic_footprint_score NUMERIC,
  ADD COLUMN IF NOT EXISTS economic_footprint_rank INTEGER;

ALTER TABLE model_snapshots
  ADD COLUMN IF NOT EXISTS adoption_score NUMERIC,
  ADD COLUMN IF NOT EXISTS economic_footprint_score NUMERIC;

CREATE INDEX IF NOT EXISTS idx_models_adoption_rank
  ON models (adoption_rank)
  WHERE adoption_rank IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_models_economic_footprint_rank
  ON models (economic_footprint_rank)
  WHERE economic_footprint_rank IS NOT NULL;
