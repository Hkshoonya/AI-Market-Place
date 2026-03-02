-- ============================================================
-- Persistence & Background Service Infrastructure
-- Creates tables for: contact form submissions, system logging,
-- and cron job run tracking.
-- ============================================================

-- ============================================================
-- CONTACT SUBMISSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS contact_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  category text DEFAULT 'general',
  subject text NOT NULL,
  message text NOT NULL,
  status text DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'archived')),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_status ON contact_submissions (status);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_created ON contact_submissions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_email ON contact_submissions (email);

ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;
-- Only service role can read/write (admin dashboard)
-- No public access policy needed

-- ============================================================
-- SYSTEM LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error')),
  source text NOT NULL,
  message text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs (level);
CREATE INDEX IF NOT EXISTS idx_system_logs_source ON system_logs (source);
CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_level_created ON system_logs (level, created_at DESC);

ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
-- Only service role can read/write

-- ============================================================
-- CRON RUNS
-- ============================================================

CREATE TABLE IF NOT EXISTS cron_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  status text DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  result_summary jsonb,
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cron_runs_job ON cron_runs (job_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_runs_status ON cron_runs (status);
CREATE INDEX IF NOT EXISTS idx_cron_runs_created ON cron_runs (created_at DESC);

ALTER TABLE cron_runs ENABLE ROW LEVEL SECURITY;
-- Only service role can read/write

-- ============================================================
-- AUTO-CLEANUP: Retain only 30 days of logs and cron runs
-- ============================================================

-- Note: Cleanup should be handled by a scheduled job or
-- Supabase pg_cron extension. Example (run manually or via pg_cron):
--
-- DELETE FROM system_logs WHERE created_at < now() - interval '30 days';
-- DELETE FROM cron_runs WHERE created_at < now() - interval '30 days';
