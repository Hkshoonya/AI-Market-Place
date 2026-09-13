-- Run this statement on its own, outside a transaction, as with migration 100.
-- Equal/null ranks need the UUID tie-breaker to page cached rows consistently.
-- Without it, late catalogue pages spill an incremental sort to disk.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_models_status_rank_id
  ON public.models (status, overall_rank ASC NULLS LAST, id ASC);

-- Verify pg_index.indisvalid, indisready, and pg_get_indexdef before rollout.
-- Keep existing indexes during the application rollback/review window.
