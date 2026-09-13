-- Online indexes: run each statement separately, outside a transaction.
-- Migration 099 is reserved for the independently reviewed billing change.
-- Do not replace CONCURRENTLY with a blocking index build on production.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cron_runs_created_at
  ON public.cron_runs (created_at DESC);

-- Chart reads only need these fixed-width values, not the large snapshot heap.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_model_snapshots_chart_cover
  ON public.model_snapshots (model_id, snapshot_date)
  INCLUDE (quality_score, hf_downloads, hf_likes, overall_rank);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_model_news_provider_published
  ON public.model_news (related_provider, published_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_models_status_id
  ON public.models (status, id);

-- Prepared status parameters cannot use the existing status='active' partial
-- rank index. This avoids sorting wide model rows under the low work_mem limit.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_models_status_overall_rank
  ON public.models (status, overall_rank);

-- Do not INCLUDE the UUID array: some rows exceed the B-tree tuple size limit.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_model_news_linked_category_id
  ON public.model_news (category, id)
  WHERE cardinality(related_model_ids) > 0;

-- Exact duplicate of idx_model_snapshots_model_date, not a constraint index.
-- Keep the original and the (model_id, snapshot_date) uniqueness constraint.
DROP INDEX CONCURRENTLY IF EXISTS public.idx_snapshots_model_date;
