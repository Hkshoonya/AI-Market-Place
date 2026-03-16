INSERT INTO agents (
  slug,
  name,
  description,
  agent_type,
  status,
  capabilities,
  config
)
VALUES (
  'verifier',
  'Verifier Agent',
  'Verifies open autonomy and platform issues after remediation attempts, then resolves or escalates them based on deterministic checks.',
  'resident',
  'active',
  jsonb_build_array('issue_verification', 'health_check', 'runtime_validation'),
  jsonb_build_object(
    'max_issues_per_run', 25,
    'max_verification_retries', 3,
    'verification_window_hours', 24
  )
)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  agent_type = EXCLUDED.agent_type,
  status = EXCLUDED.status,
  capabilities = EXCLUDED.capabilities,
  config = COALESCE(agents.config, '{}'::jsonb) || EXCLUDED.config,
  updated_at = NOW();
