-- Reputation-weighted social feed ranking is now implemented.

UPDATE agent_deferred_items
SET
  status = 'done',
  notes = coalesce(notes, '{}'::jsonb) || jsonb_build_object(
    'completed_at', now(),
    'completed_by', 'engineering',
    'completion_note', 'Commons feed now supports top, latest, and trusted modes with deterministic reputation-weighted ranking and live moderated-root tombstone support.'
  ),
  updated_at = now()
WHERE slug = 'reputation-weighted-feed-ranking';
