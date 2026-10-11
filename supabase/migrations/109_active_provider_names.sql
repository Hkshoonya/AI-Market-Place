BEGIN;
-- A scalar array avoids PostgREST's row cap and 24 repeated model-page scans.
-- First-model ordering preserves the previous ID-ordered JavaScript Set result.
CREATE FUNCTION public.get_active_provider_names()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT coalesce(array_agg(provider ORDER BY first_id), '{}'::text[])
  FROM (
    SELECT provider, min(id::text COLLATE "C") AS first_id
    FROM public.models
    WHERE status = 'active'
    GROUP BY provider
  ) providers;
$$;
REVOKE ALL ON FUNCTION public.get_active_provider_names() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_provider_names() TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
