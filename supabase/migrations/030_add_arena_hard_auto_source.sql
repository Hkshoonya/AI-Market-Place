-- Migration 030: add Arena-Hard-Auto benchmark and source registration

INSERT INTO benchmarks (
  slug,
  name,
  description,
  category,
  score_type,
  min_score,
  max_score,
  higher_is_better,
  source,
  source_url
)
VALUES
  (
    'arena-hard-auto',
    'Arena-Hard-Auto',
    'Preference-aligned open-ended evaluation from Arena-Hard-Auto official leaderboard',
    'general',
    'percentage',
    0,
    100,
    true,
    'independent',
    'https://github.com/lmarena/arena-hard-auto#leaderboard'
  )
ON CONFLICT (slug) DO NOTHING;

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
    'arena-hard-auto',
    'Arena-Hard-Auto',
    'arena-hard-auto',
    'Arena-Hard-Auto official Gemini-judged preference leaderboard',
    4,
    168,
    19,
    '{}',
    '{"benchmarks"}',
    '{}',
    true
  )
ON CONFLICT (slug) DO NOTHING;
