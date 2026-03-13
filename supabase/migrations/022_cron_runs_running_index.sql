-- Prevent duplicate running cron_runs rows for the same job.
-- The dedicated cron_job_locks table is the primary guard; this index keeps
-- cron_runs telemetry consistent if an older runner path still overlaps.

CREATE UNIQUE INDEX IF NOT EXISTS idx_cron_runs_running_job_unique
  ON cron_runs (job_name)
  WHERE status = 'running';
