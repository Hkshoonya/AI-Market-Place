CREATE TABLE IF NOT EXISTS workspace_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  runtime_id UUID REFERENCES workspace_runtimes(id) ON DELETE SET NULL,
  model_slug TEXT NOT NULL,
  model_name TEXT NOT NULL,
  provider_name TEXT,
  status TEXT NOT NULL DEFAULT 'provisioning' CHECK (status IN ('provisioning', 'ready', 'paused', 'failed')),
  endpoint_slug TEXT NOT NULL UNIQUE,
  deployment_kind TEXT NOT NULL DEFAULT 'managed_api' CHECK (deployment_kind IN ('managed_api', 'assistant_only')),
  deployment_label TEXT,
  credits_budget NUMERIC(12,2),
  monthly_price_estimate NUMERIC(12,2),
  total_requests INTEGER NOT NULL DEFAULT 0,
  total_tokens BIGINT NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, model_slug)
);

CREATE INDEX IF NOT EXISTS idx_workspace_deployments_user_updated
  ON workspace_deployments (user_id, updated_at DESC);

ALTER TABLE workspace_deployments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own workspace deployments" ON workspace_deployments;
CREATE POLICY "Users manage own workspace deployments"
  ON workspace_deployments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages workspace deployments" ON workspace_deployments;
CREATE POLICY "Service role manages workspace deployments"
  ON workspace_deployments FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS workspace_deployments_updated_at ON workspace_deployments;
CREATE TRIGGER workspace_deployments_updated_at
  BEFORE UPDATE ON workspace_deployments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
