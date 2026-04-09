ALTER TABLE workspace_deployments
  DROP CONSTRAINT IF EXISTS workspace_deployments_deployment_kind_check;

ALTER TABLE workspace_deployments
  ADD COLUMN IF NOT EXISTS external_platform_slug TEXT,
  ADD COLUMN IF NOT EXISTS external_provider TEXT,
  ADD COLUMN IF NOT EXISTS external_owner TEXT,
  ADD COLUMN IF NOT EXISTS external_name TEXT,
  ADD COLUMN IF NOT EXISTS external_model_ref TEXT,
  ADD COLUMN IF NOT EXISTS external_web_url TEXT;

ALTER TABLE workspace_deployments
  ADD CONSTRAINT workspace_deployments_deployment_kind_check
  CHECK (deployment_kind IN ('managed_api', 'assistant_only', 'hosted_external'));
