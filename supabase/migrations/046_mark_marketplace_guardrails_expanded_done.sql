UPDATE agent_deferred_items
SET
  status = 'done',
  notes = COALESCE(notes, '{}'::jsonb) || jsonb_build_object(
    'expanded_guardrails_completed_at', now(),
    'expanded_guardrails_completed_by', 'codex',
    'expanded_completion_note', 'Listings now carry dual-axis content/autonomy risk outputs, richer admin review summaries, and agent-vs-human purchase enforcement.'
  ),
  updated_at = now()
WHERE slug IN ('illegal-goods-policy-engine', 'autonomous-commerce-guardrails');
