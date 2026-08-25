CREATE TABLE IF NOT EXISTS model_metadata_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (char_length(source) BETWEEN 2 AND 80),
  source_record_id TEXT NOT NULL CHECK (char_length(source_record_id) BETWEEN 1 AND 500),
  source_name TEXT NOT NULL CHECK (char_length(source_name) BETWEEN 1 AND 500),
  source_url TEXT CHECK (
    source_url IS NULL OR (
      char_length(source_url) <= 2000
      AND source_url ~ '^https://'
    )
  ),
  publication_date DATE,
  parameter_count BIGINT CHECK (parameter_count IS NULL OR parameter_count > 0),
  training_compute_flop NUMERIC CHECK (training_compute_flop IS NULL OR training_compute_flop > 0),
  training_dataset_size NUMERIC CHECK (training_dataset_size IS NULL OR training_dataset_size > 0),
  base_model TEXT,
  accessibility TEXT,
  is_open_weights BOOLEAN,
  confidence TEXT,
  abstract TEXT,
  source_last_modified_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (model_id, source)
);

CREATE INDEX IF NOT EXISTS idx_model_metadata_evidence_model
  ON model_metadata_evidence (model_id, source);

CREATE INDEX IF NOT EXISTS idx_model_metadata_evidence_source_modified
  ON model_metadata_evidence (source, source_last_modified_at DESC);

ALTER TABLE model_metadata_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read model metadata evidence" ON model_metadata_evidence;
CREATE POLICY "Public can read model metadata evidence"
  ON model_metadata_evidence FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role manages model metadata evidence" ON model_metadata_evidence;
CREATE POLICY "Service role manages model metadata evidence"
  ON model_metadata_evidence FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

GRANT SELECT ON model_metadata_evidence TO anon, authenticated;
GRANT ALL ON model_metadata_evidence TO service_role;

DROP TRIGGER IF EXISTS model_metadata_evidence_updated_at ON model_metadata_evidence;
CREATE TRIGGER model_metadata_evidence_updated_at
  BEFORE UPDATE ON model_metadata_evidence
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO data_sources (
  slug,
  name,
  adapter_type,
  description,
  tier,
  sync_interval_hours,
  priority,
  secret_env_keys,
  output_types,
  config,
  is_enabled
)
VALUES (
  'epoch-ai-models',
  'Epoch AI Models',
  'epoch-ai-models',
  'Daily research metadata for model parameters, training compute, dataset scale, release dates, and provenance.',
  4,
  24,
  5,
  ARRAY[]::TEXT[],
  ARRAY['models']::TEXT[],
  '{}'::JSONB,
  TRUE
)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  adapter_type = EXCLUDED.adapter_type,
  description = EXCLUDED.description,
  tier = EXCLUDED.tier,
  sync_interval_hours = EXCLUDED.sync_interval_hours,
  priority = EXCLUDED.priority,
  secret_env_keys = EXCLUDED.secret_env_keys,
  output_types = EXCLUDED.output_types,
  is_enabled = EXCLUDED.is_enabled,
  updated_at = NOW();
