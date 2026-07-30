UPDATE model_news
SET
  published_at = created_at,
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{published_at_source}',
    '"first_seen"'::jsonb,
    TRUE
  )
WHERE source = 'provider-blog'
  AND created_at IS NOT NULL
  AND published_at > created_at + INTERVAL '5 minutes';
