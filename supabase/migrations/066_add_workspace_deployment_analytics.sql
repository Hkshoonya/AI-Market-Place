ALTER TABLE workspace_deployments
  ADD COLUMN IF NOT EXISTS successful_requests INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_requests INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_response_latency_ms INTEGER,
  ADD COLUMN IF NOT EXISTS last_response_latency_ms INTEGER;

ALTER TABLE workspace_deployment_events
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER;
