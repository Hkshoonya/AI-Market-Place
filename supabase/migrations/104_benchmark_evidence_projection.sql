-- Run after 103. The brief write lock makes the backfill and trigger installation
-- one consistent change; fail rather than queue behind a busy ingestion job.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE public.model_news IN SHARE ROW EXCLUSIVE MODE;

-- Keep evidence arrays separate from large news bodies/metadata. This is a
-- transactionally maintained projection, not a periodically stale cache.
CREATE TABLE public.benchmark_evidence_links (
  news_id uuid PRIMARY KEY REFERENCES public.model_news(id) ON UPDATE CASCADE ON DELETE CASCADE,
  related_model_ids uuid[] NOT NULL CHECK (cardinality(related_model_ids) > 0)
);
ALTER TABLE public.benchmark_evidence_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.benchmark_evidence_links FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.benchmark_evidence_links TO service_role;

CREATE FUNCTION public.sync_benchmark_evidence_links()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.category = 'benchmark' AND cardinality(NEW.related_model_ids) > 0 THEN
    INSERT INTO public.benchmark_evidence_links AS links (news_id, related_model_ids)
    VALUES (NEW.id, NEW.related_model_ids)
    ON CONFLICT (news_id) DO UPDATE SET related_model_ids = EXCLUDED.related_model_ids
    WHERE links.related_model_ids IS DISTINCT FROM EXCLUDED.related_model_ids;
  ELSE
    DELETE FROM public.benchmark_evidence_links WHERE news_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_benchmark_evidence_links() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER model_news_sync_benchmark_evidence_insert
AFTER INSERT ON public.model_news
FOR EACH ROW WHEN (NEW.category = 'benchmark' AND cardinality(NEW.related_model_ids) > 0)
EXECUTE FUNCTION public.sync_benchmark_evidence_links();

CREATE TRIGGER model_news_sync_benchmark_evidence_update
AFTER UPDATE OF category, related_model_ids ON public.model_news
FOR EACH ROW WHEN (
  OLD.category IS DISTINCT FROM NEW.category OR
  OLD.related_model_ids IS DISTINCT FROM NEW.related_model_ids
)
EXECUTE FUNCTION public.sync_benchmark_evidence_links();

INSERT INTO public.benchmark_evidence_links (news_id, related_model_ids)
SELECT id, related_model_ids FROM public.model_news
WHERE category = 'benchmark' AND cardinality(related_model_ids) > 0;

CREATE OR REPLACE FUNCTION public.get_benchmark_evidence_model_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT coalesce(array_agg(model_id ORDER BY model_id), '{}'::uuid[])
  FROM (
    SELECT DISTINCT unnest(related_model_ids) AS model_id
    FROM public.benchmark_evidence_links
  ) evidence
  WHERE model_id IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.get_benchmark_evidence_model_ids() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_benchmark_evidence_model_ids() TO service_role;
ANALYZE public.benchmark_evidence_links;
COMMIT;
