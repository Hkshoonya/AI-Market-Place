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
  'provider-deployment-signals',
  'Provider Deployment Signals',
  'provider-deployment-signals',
  'Official provider pages about self-hosting, open weights, and local-tool deployment availability',
  2,
  4,
  9,
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

UPDATE data_sources
SET output_types = ARRAY['pricing', 'news']::text[],
    updated_at = now()
WHERE slug = 'ollama-library';

UPDATE pipeline_health ph
SET expected_interval_hours = ds.sync_interval_hours,
    updated_at = now()
FROM data_sources ds
WHERE ph.source_slug = ds.slug
  AND ds.slug IN ('provider-deployment-signals', 'ollama-library');
