-- User-owned provider credentials are encrypted by the application before storage.
-- No authenticated-user policy is intentionally created: all access goes through
-- authenticated server routes using the service role and user_id filters.

CREATE TABLE IF NOT EXISTS provider_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('openrouter', 'replicate', 'huggingface')),
  display_name TEXT NOT NULL,
  encrypted_secret TEXT NOT NULL,
  secret_hint TEXT NOT NULL,
  external_account_id TEXT,
  external_account_name TEXT,
  capabilities TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invalid', 'revoked')),
  last_validated_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_provider_connections_user_status
  ON provider_connections (user_id, status, provider);

ALTER TABLE provider_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages provider connections" ON provider_connections;
CREATE POLICY "Service role manages provider connections"
  ON provider_connections FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS provider_connections_updated_at ON provider_connections;
CREATE TRIGGER provider_connections_updated_at
  BEFORE UPDATE ON provider_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE workspace_deployments
  ADD COLUMN IF NOT EXISTS provider_connection_id UUID
    REFERENCES provider_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS billing_source TEXT NOT NULL DEFAULT 'platform_wallet';

ALTER TABLE workspace_deployments
  DROP CONSTRAINT IF EXISTS workspace_deployments_billing_source_check;

ALTER TABLE workspace_deployments
  ADD CONSTRAINT workspace_deployments_billing_source_check
  CHECK (billing_source IN ('platform_wallet', 'provider_account'));

ALTER TABLE workspace_deployments
  DROP CONSTRAINT IF EXISTS workspace_deployments_deployment_kind_check;

ALTER TABLE workspace_deployments
  ADD CONSTRAINT workspace_deployments_deployment_kind_check
  CHECK (
    deployment_kind IN (
      'managed_api',
      'assistant_only',
      'hosted_external',
      'connected_inference'
    )
  );

CREATE INDEX IF NOT EXISTS idx_workspace_deployments_provider_connection
  ON workspace_deployments (provider_connection_id)
  WHERE provider_connection_id IS NOT NULL;
