-- A scalar array avoids PostgREST's row limit while preserving every model ID.
-- Read the nonempty arrays once instead of repeatedly scanning OFFSET pages.
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
    FROM public.model_news
    WHERE category = 'benchmark' AND cardinality(related_model_ids) > 0
  ) evidence
  WHERE model_id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_benchmark_evidence_model_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_benchmark_evidence_model_ids() FROM anon;
REVOKE ALL ON FUNCTION public.get_benchmark_evidence_model_ids() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_benchmark_evidence_model_ids() TO service_role;
