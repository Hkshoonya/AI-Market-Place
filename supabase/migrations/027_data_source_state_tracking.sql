-- Explicit runtime state tracking for data sources.
-- Keeps operator intent (`is_enabled`) separate from runtime quarantine state.

ALTER TABLE data_sources
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_success_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS quarantined_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS quarantine_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_data_sources_quarantined_at
  ON data_sources (quarantined_at)
  WHERE quarantined_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_data_sources_last_success_at
  ON data_sources (last_success_at DESC);

UPDATE data_sources
SET last_success_at = COALESCE(last_success_at, last_sync_at)
WHERE last_sync_at IS NOT NULL
  AND last_success_at IS NULL;
