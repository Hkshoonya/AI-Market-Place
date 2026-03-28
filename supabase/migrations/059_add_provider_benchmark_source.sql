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
  'provider-benchmarks',
  'Provider Benchmarks',
  'provider-benchmarks',
  'Official provider benchmark pages and benchmark claims from vendor sites',
  2,
  4,
  8,
  ARRAY[]::text[],
  ARRAY['news']::text[],
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

UPDATE pipeline_health ph
SET expected_interval_hours = ds.sync_interval_hours,
    updated_at = now()
FROM data_sources ds
WHERE ph.source_slug = ds.slug
  AND ds.slug IN ('provider-benchmarks');
