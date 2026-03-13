-- Migration 028: add low-API benchmark definitions and source registrations

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
    'livecodebench',
    'LiveCodeBench',
    'Competitive programming and code-generation benchmark',
    'coding',
    'pass_rate',
    0,
    100,
    true,
    'livecodebench',
    'https://livecodebench.github.io/leaderboard.html'
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
    'livecodebench',
    'LiveCodeBench',
    'livecodebench',
    'LiveCodeBench code-generation benchmark artifact feed',
    4,
    168,
    15,
    '{}',
    '{"benchmarks"}',
    '{}',
    true
  ),
  (
    'swe-bench',
    'SWE-Bench',
    'swe-bench',
    'SWE-Bench verified software-engineering benchmark results',
    4,
    168,
    18,
    '{}',
    '{"benchmarks"}',
    '{}',
    true
  )
ON CONFLICT (slug) DO NOTHING;
