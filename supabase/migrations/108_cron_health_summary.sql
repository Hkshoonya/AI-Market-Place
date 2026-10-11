BEGIN;
CREATE FUNCTION public.get_cron_health_summary()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH recent AS MATERIALIZED (
    SELECT id, btrim(job_name) AS job_name, status, started_at, created_at,
      coalesce(starts_with(error_message, 'Marked stale before acquiring cron lock for'), false) AS auto_staled
    FROM public.cron_runs
    WHERE created_at >= now() - interval '24 hours'
  ), latest_jobs AS (
    SELECT DISTINCT ON (job_name) job_name, status
    FROM recent WHERE job_name IS NOT NULL AND job_name <> ''
    ORDER BY job_name, created_at DESC, id DESC
  )
  SELECT jsonb_build_object(
    'runCount', count(*),
    'runningJobs', count(*) FILTER (WHERE status = 'running'),
    'recentFailures24h', count(*) FILTER (WHERE status = 'failed' AND NOT auto_staled),
    'latestFailedJobs24h', (SELECT count(*) FROM latest_jobs WHERE status = 'failed'),
    'lastRunAt', (SELECT coalesce(started_at, created_at) FROM recent ORDER BY created_at DESC, id DESC LIMIT 1)
  )
  FROM recent;
$$;
REVOKE ALL ON FUNCTION public.get_cron_health_summary() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cron_health_summary() TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
