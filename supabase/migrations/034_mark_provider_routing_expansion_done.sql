-- Provider routing is now the shared path for current LLM-backed resident-agent flows.

UPDATE agent_deferred_items
SET
  status = 'done',
  notes = coalesce(notes, '{}'::jsonb) || jsonb_build_object(
    'completed_at', now(),
    'completed_by', 'engineering',
    'completion_note', 'Current LLM-backed agent flows route through the shared provider router with OpenRouter, DeepSeek, MiniMax, and Anthropic support.'
  ),
  updated_at = now()
WHERE slug = 'provider-routing-expansion';
