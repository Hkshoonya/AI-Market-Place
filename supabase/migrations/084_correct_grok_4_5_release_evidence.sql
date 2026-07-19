-- xAI's current announcement and API documentation date Grok 4.5 to July 16.
UPDATE models
SET
  release_date = '2026-07-16',
  data_refreshed_at = NOW(),
  updated_at = NOW()
WHERE slug = 'x-ai-grok-4-5';

UPDATE model_news
SET published_at = TIMESTAMPTZ '2026-07-16 00:00:00+00'
WHERE source = 'provider-benchmarks'
  AND source_id = 'provider-benchmarks-xai-grok-4-5';

UPDATE benchmark_scores
SET evaluation_date = '2026-07-16'
WHERE source = 'provider-benchmarks'
  AND source_url = 'https://x.ai/news/grok-4-5'
  AND metadata->>'source_key' = 'xai-grok-4-5';
