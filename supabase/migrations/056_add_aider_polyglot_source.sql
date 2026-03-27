INSERT INTO data_sources (
  slug,
  name,
  adapter_type,
  description,
  tier,
  sync_interval_hours,
  priority,
  secret_env_keys,
  output_types,
  is_enabled,
  config
)
VALUES (
  'aider-polyglot',
  'Aider Polyglot',
  'aider-polyglot',
  'Aider polyglot coding leaderboard from the official aider site',
  3,
  8,
  45,
  ARRAY[]::text[],
  ARRAY['benchmarks']::text[],
  true,
  '{}'::jsonb
)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    adapter_type = EXCLUDED.adapter_type,
    description = EXCLUDED.description,
    tier = EXCLUDED.tier,
    sync_interval_hours = EXCLUDED.sync_interval_hours,
    priority = EXCLUDED.priority,
    output_types = EXCLUDED.output_types,
    is_enabled = EXCLUDED.is_enabled,
    updated_at = now();

UPDATE pipeline_health
SET expected_interval_hours = 8,
    updated_at = now()
WHERE source_slug = 'aider-polyglot';
