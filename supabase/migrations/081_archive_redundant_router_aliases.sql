-- OpenRouter's tilde-prefixed alias points at the canonical Claude Fable 5 row.
-- Keep the historical model row archived for referential integrity and remove
-- its duplicate router pricing now that future syncs canonicalize the slug.
DELETE FROM model_pricing
WHERE model_id IN (
  SELECT id
  FROM models
  WHERE slug = 'anthropic-claude-fable-latest'
);

UPDATE models
SET
  status = 'archived',
  is_api_available = FALSE,
  data_refreshed_at = NOW(),
  updated_at = NOW()
WHERE slug = 'anthropic-claude-fable-latest';
