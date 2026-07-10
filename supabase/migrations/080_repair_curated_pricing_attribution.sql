-- Remove direct-provider pricing that was attached to third-party derivatives by
-- substring matching. Hosting prices such as OpenRouter, Together, Azure, and
-- Bedrock are intentionally preserved.
WITH normalized_models AS (
  SELECT
    id,
    slug,
    regexp_replace(lower(provider), '[^a-z0-9]', '', 'g') AS provider_key
  FROM models
)
DELETE FROM model_pricing AS pricing
USING normalized_models AS model
WHERE pricing.model_id = model.id
  AND pricing.source <> 'openrouter'
  AND (
    CASE pricing.provider_name
      WHEN 'OpenAI' THEN model.provider_key NOT IN ('openai')
      WHEN 'Anthropic' THEN model.provider_key NOT IN ('anthropic')
      WHEN 'Google' THEN model.provider_key NOT IN ('google', 'googledeepmind', 'gemini')
      WHEN 'Meta' THEN model.provider_key NOT IN ('meta', 'metaai', 'metallama')
      WHEN 'DeepSeek' THEN model.provider_key NOT IN ('deepseek', 'deepseekai')
      WHEN 'Mistral' THEN model.provider_key NOT IN ('mistral', 'mistralai')
      WHEN 'MiniMax' THEN model.provider_key NOT IN ('minimax', 'minimaxai')
      WHEN 'Cohere' THEN model.provider_key NOT IN ('cohere', 'coherelabs')
      WHEN 'Amazon' THEN model.provider_key NOT IN ('amazon')
      WHEN 'Black Forest Labs' THEN model.provider_key NOT IN ('blackforestlabs')
      WHEN 'AI21' THEN model.provider_key NOT IN ('ai21', 'ai21labs')
      WHEN 'xAI' THEN model.provider_key NOT IN ('xai')
      ELSE FALSE
    END
    OR (
      pricing.provider_name = 'OpenAI'
      AND model.slug ~ '^openai-gpt-5-6-(sol|terra|luna)-pro$'
    )
  );

-- The old OpenRouter alias represented the same model as Claude Fable 5.
-- Keep the row for referential integrity but remove it from public/API surfaces.
UPDATE models
SET
  status = 'archived',
  is_api_available = FALSE,
  data_refreshed_at = NOW(),
  updated_at = NOW()
WHERE slug = 'anthropic-claude-fable-latest';

-- Restore safety and availability metadata that older router syncs replaced.
UPDATE models
SET
  name = 'Claude Fable 5',
  provider = 'Anthropic',
  status = 'active',
  is_open_weights = FALSE,
  is_api_available = TRUE,
  license = 'commercial',
  license_name = NULL,
  capabilities = COALESCE(capabilities, '{}'::jsonb) || jsonb_build_object(
    'vision', TRUE,
    'tool_use', TRUE,
    'adaptive_thinking', TRUE,
    'coding', TRUE,
    'reasoning', TRUE,
    'computer_use', TRUE,
    'streaming', TRUE,
    'safety_routing', TRUE,
    'data_retention_required', TRUE
  ),
  updated_at = NOW()
WHERE slug = 'anthropic-claude-fable-5';

-- OpenRouter exposes these as the same underlying models with pro reasoning
-- mode. Preserve them as distinct routing options without presenting them as
-- duplicate base rows.
UPDATE models
SET
  name = CASE slug
    WHEN 'openai-gpt-5-6-sol-pro' THEN 'GPT-5.6 Sol Pro'
    WHEN 'openai-gpt-5-6-terra-pro' THEN 'GPT-5.6 Terra Pro'
    WHEN 'openai-gpt-5-6-luna-pro' THEN 'GPT-5.6 Luna Pro'
    ELSE name
  END,
  status = 'preview',
  is_open_weights = FALSE,
  is_api_available = TRUE,
  license = 'commercial',
  license_name = NULL,
  updated_at = NOW()
WHERE slug ~ '^openai-gpt-5-6-(sol|terra|luna)-pro$';
