ALTER TABLE workspace_deployments
  ADD COLUMN IF NOT EXISTS last_success_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error_message TEXT;

CREATE TABLE IF NOT EXISTS workspace_deployment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id UUID NOT NULL REFERENCES workspace_deployments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'request_succeeded',
      'request_failed',
      'deployment_created',
      'deployment_paused',
      'deployment_resumed',
      'budget_updated'
    )
  ),
  request_message TEXT,
  response_preview TEXT,
  provider_name TEXT,
  model_name TEXT,
  tokens_used INTEGER,
  charge_amount NUMERIC(12,2),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_deployment_events_deployment_created
  ON workspace_deployment_events (deployment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_deployment_events_user_created
  ON workspace_deployment_events (user_id, created_at DESC);

ALTER TABLE workspace_deployment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own workspace deployment events" ON workspace_deployment_events;
CREATE POLICY "Users manage own workspace deployment events"
  ON workspace_deployment_events FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages workspace deployment events" ON workspace_deployment_events;
CREATE POLICY "Service role manages workspace deployment events"
  ON workspace_deployment_events FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
