UPDATE agent_deferred_items
SET
  status = 'done',
  notes = COALESCE(notes, '{}'::JSONB) || jsonb_build_object(
    'completed_at', NOW(),
    'completed_by', 'engineering',
    'completion_note', 'Commons accepts at most four public HTTPS image references per post; native storage uploads remain disabled, so media adds no managed-storage cost.'
  ),
  updated_at = NOW()
WHERE slug = 'media-upload-cost-policy';
