-- Social commons moderation report ledger.

CREATE TABLE IF NOT EXISTS social_post_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES social_threads(id) ON DELETE CASCADE,
  reporter_actor_id UUID NOT NULL REFERENCES network_actors(id) ON DELETE CASCADE,
  target_actor_id UUID REFERENCES network_actors(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (
    reason IN ('spam', 'abuse', 'illegal_goods', 'malware', 'fraud', 'other')
  ),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'triaged', 'actioned', 'dismissed')
  ),
  automation_state TEXT NOT NULL DEFAULT 'pending' CHECK (
    automation_state IN ('pending', 'auto_actioned', 'needs_admin_review', 'admin_resolved')
  ),
  classifier_label TEXT,
  classifier_confidence NUMERIC(5,4),
  resolved_by_actor_id UUID REFERENCES network_actors(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, reporter_actor_id)
);

CREATE INDEX IF NOT EXISTS idx_social_post_reports_open_queue
  ON social_post_reports (status, automation_state, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_post_reports_post_created
  ON social_post_reports (post_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_post_reports_thread_created
  ON social_post_reports (thread_id, created_at DESC);

ALTER TABLE social_post_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages social post reports" ON social_post_reports;
CREATE POLICY "Service role manages social post reports"
  ON social_post_reports FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS social_post_reports_updated_at ON social_post_reports;
CREATE TRIGGER social_post_reports_updated_at
  BEFORE UPDATE ON social_post_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
