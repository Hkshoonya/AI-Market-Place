CREATE TABLE IF NOT EXISTS workspace_sessions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE workspace_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own workspace sessions" ON workspace_sessions;
CREATE POLICY "Users manage own workspace sessions"
  ON workspace_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages workspace sessions" ON workspace_sessions;
CREATE POLICY "Service role manages workspace sessions"
  ON workspace_sessions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS workspace_sessions_updated_at ON workspace_sessions;
CREATE TRIGGER workspace_sessions_updated_at
  BEFORE UPDATE ON workspace_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
