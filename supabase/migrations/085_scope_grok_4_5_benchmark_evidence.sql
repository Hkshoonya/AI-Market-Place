-- Keep Grok 4.5 launch evidence off the older Grok 4 model page and coverage.
UPDATE model_news AS news
SET related_model_ids = ARRAY[model.id]
FROM models AS model
WHERE news.source = 'provider-benchmarks'
  AND news.source_id = 'provider-benchmarks-xai-grok-4-5'
  AND model.slug = 'x-ai-grok-4-5';
