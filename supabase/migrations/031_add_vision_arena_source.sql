-- Migration 031: add Vision Arena data source registration

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
  config,
  is_enabled
)
VALUES
  (
    'vision-arena',
    'Vision Arena',
    'vision-arena',
    'Arena vision leaderboard Elo ratings from the official site',
    2,
    12,
    42,
    '{}',
    '{"elo_ratings"}',
    '{}',
    true
  )
ON CONFLICT (slug) DO NOTHING;
