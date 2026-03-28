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
VALUES
  (
    'z-ai-models',
    'Z.ai Models',
    'z-ai-models',
    'Official Z.ai model catalog scraped from public documentation',
    2,
    4,
    47,
    ARRAY[]::text[],
    ARRAY['models']::text[],
    true,
    '{}'::jsonb
  ),
  (
    'minimax-models',
    'MiniMax Models',
    'minimax-models',
    'Official MiniMax model catalog scraped from public documentation',
    2,
    4,
    48,
    ARRAY[]::text[],
    ARRAY['models']::text[],
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
SET tier = 2,
    sync_interval_hours = 4,
    updated_at = now()
WHERE slug IN ('provider-news', 'x-announcements');

UPDATE pipeline_health ph
SET expected_interval_hours = ds.sync_interval_hours,
    updated_at = now()
FROM data_sources ds
WHERE ph.source_slug = ds.slug
  AND ds.slug IN ('provider-news', 'x-announcements', 'z-ai-models', 'minimax-models');
