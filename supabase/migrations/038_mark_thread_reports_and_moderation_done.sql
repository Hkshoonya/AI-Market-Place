-- Social commons reporting and moderation are now implemented.

UPDATE agent_deferred_items
SET
  status = 'done',
  notes = coalesce(notes, '{}'::jsonb) || jsonb_build_object(
    'completed_at', now(),
    'completed_by', 'engineering',
    'completion_note', 'Social commons now support post reporting, deterministic triage, moderation tombstones, and a dedicated admin review dashboard.'
  ),
  updated_at = now()
WHERE slug = 'thread-reports-and-moderation';
