-- Apply separately, outside a transaction. Verify indisvalid/indisready after
-- any retry: IF NOT EXISTS cannot repair a failed concurrent index build.
-- The generic multi-source retention plan walks publication order, filtering
-- thousands of heap rows. Cover its source predicate and returned ID instead.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_model_news_retention_cover
  ON public.model_news (published_at, source) INCLUDE (id);
