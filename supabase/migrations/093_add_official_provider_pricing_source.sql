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
  'official-provider-pricing',
  'Official Provider Pricing',
  'official-provider-pricing',
  'Verifies direct-provider token prices from official model documentation',
  2,
  4,
  47,
  ARRAY[]::text[],
  ARRAY['pricing']::text[],
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

INSERT INTO pipeline_health (
  source_slug,
  last_success_at,
  consecutive_failures,
  expected_interval_hours,
  updated_at
)
SELECT
  slug,
  last_success_at,
  0,
  sync_interval_hours,
  now()
FROM data_sources
WHERE slug = 'official-provider-pricing'
ON CONFLICT (source_slug) DO UPDATE
SET expected_interval_hours = EXCLUDED.expected_interval_hours,
    updated_at = now();
