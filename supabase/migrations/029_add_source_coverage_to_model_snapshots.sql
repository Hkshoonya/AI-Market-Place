ALTER TABLE model_snapshots
ADD COLUMN IF NOT EXISTS source_coverage JSONB DEFAULT '{}';
