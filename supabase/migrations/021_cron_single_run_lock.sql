-- Prevent duplicate cron executions across internal, external, and backup schedulers.

CREATE TABLE IF NOT EXISTS cron_job_locks (
  job_name text PRIMARY KEY,
  lock_token uuid NOT NULL,
  locked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  owner text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cron_job_locks_expires_at
  ON cron_job_locks (expires_at);

ALTER TABLE cron_job_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages cron job locks" ON cron_job_locks;
CREATE POLICY "Service role manages cron job locks"
  ON cron_job_locks FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION acquire_cron_lock(
  p_job_name text,
  p_lock_token uuid,
  p_ttl_seconds integer DEFAULT 900
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_ttl_seconds integer := GREATEST(COALESCE(p_ttl_seconds, 900), 30);
  v_acquired boolean := false;
BEGIN
  INSERT INTO cron_job_locks (
    job_name,
    lock_token,
    locked_at,
    expires_at,
    owner,
    updated_at
  )
  VALUES (
    p_job_name,
    p_lock_token,
    v_now,
    v_now + make_interval(secs => v_ttl_seconds),
    auth.role(),
    v_now
  )
  ON CONFLICT (job_name) DO UPDATE
    SET lock_token = EXCLUDED.lock_token,
        locked_at = EXCLUDED.locked_at,
        expires_at = EXCLUDED.expires_at,
        owner = EXCLUDED.owner,
        updated_at = EXCLUDED.updated_at
    WHERE cron_job_locks.expires_at <= v_now
  RETURNING true INTO v_acquired;

  RETURN COALESCE(v_acquired, false);
END;
$$;

CREATE OR REPLACE FUNCTION release_cron_lock(
  p_job_name text,
  p_lock_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer := 0;
BEGIN
  DELETE FROM cron_job_locks
   WHERE job_name = p_job_name
     AND lock_token = p_lock_token;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;
