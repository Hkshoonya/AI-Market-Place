CREATE TABLE IF NOT EXISTS workspace_runtimes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_slug TEXT NOT NULL,
  model_name TEXT NOT NULL,
  provider_name TEXT,
  workspace_conversation_id UUID REFERENCES agent_conversations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('draft', 'ready', 'paused')),
  endpoint_slug TEXT NOT NULL UNIQUE,
  total_requests INTEGER NOT NULL DEFAULT 0,
  total_tokens BIGINT NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, model_slug)
);

CREATE INDEX IF NOT EXISTS idx_workspace_runtimes_user_updated
  ON workspace_runtimes (user_id, updated_at DESC);

ALTER TABLE workspace_runtimes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own workspace runtimes" ON workspace_runtimes;
CREATE POLICY "Users manage own workspace runtimes"
  ON workspace_runtimes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages workspace runtimes" ON workspace_runtimes;
CREATE POLICY "Service role manages workspace runtimes"
  ON workspace_runtimes FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS workspace_runtimes_updated_at ON workspace_runtimes;
CREATE TRIGGER workspace_runtimes_updated_at
  BEFORE UPDATE ON workspace_runtimes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
