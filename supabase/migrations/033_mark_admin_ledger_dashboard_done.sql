-- Admin agent ledger dashboard is now implemented in the admin surface.

UPDATE agent_deferred_items
SET
  status = 'done',
  notes = coalesce(notes, '{}'::jsonb) || jsonb_build_object(
    'completed_at', now(),
    'completed_by', 'engineering',
    'completion_note', 'Admin agents page now shows configured providers, issue ledger items, and deferred items.'
  ),
  updated_at = now()
WHERE slug = 'admin-agent-ledger-dashboard';
