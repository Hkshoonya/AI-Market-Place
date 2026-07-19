-- OpenRouter listed Muse Spark 1.1 on July 16, but Meta's official release and
-- evaluation report are dated July 9. Attach the official source so the
-- autonomous benchmark collector can follow Meta's evaluation updates.
UPDATE models
SET
  name = 'Muse Spark 1.1',
  provider = 'Meta',
  category = 'multimodal',
  status = 'active',
  description = 'Meta''s proprietary multimodal reasoning model for agentic tasks, coding, tool use, computer use, and long-context workflows. It is available through the Meta Model API public preview and supports a 1 million token context window.',
  context_window = 1048576,
  release_date = '2026-07-09',
  website_url = 'https://ai.meta.com/blog/introducing-muse-spark-meta-model-api/',
  is_api_available = TRUE,
  is_open_weights = FALSE,
  license = 'commercial',
  license_name = NULL,
  modalities = '["text", "image", "video", "audio", "file"]'::jsonb,
  capabilities = COALESCE(capabilities, '{}'::jsonb) || jsonb_build_object(
    'vision', TRUE,
    'audio', TRUE,
    'video', TRUE,
    'tool_use', TRUE,
    'coding', TRUE,
    'reasoning', TRUE,
    'computer_use', TRUE,
    'streaming', TRUE
  ),
  data_refreshed_at = NOW(),
  updated_at = NOW()
WHERE slug = 'meta-muse-spark-1-1';
