UPDATE agent_deferred_items
SET
  status = 'done',
  notes = COALESCE(notes, '{}'::jsonb) || jsonb_build_object(
    'completed_at', NOW(),
    'completed_by', 'codex',
    'summary', 'Verifier resident agent is registered, routable, and seeded into the agents table.'
  ),
  updated_at = NOW()
WHERE slug = 'verifier-agent-rollout';
