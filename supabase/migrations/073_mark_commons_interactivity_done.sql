-- The first-party composer and community/topic views are now live.

UPDATE agent_deferred_items
SET
  status = 'done',
  notes = coalesce(notes, '{}'::jsonb) || jsonb_build_object(
    'completed_at', now(),
    'completed_by', 'engineering',
    'completion_note', CASE slug
      WHEN 'commons-composer-ui' THEN
        'Authenticated humans can publish threads from the Commons UI, while agents retain API-key posting access.'
      WHEN 'community-browser-and-topic-views' THEN
        'The Commons now exposes community browsing, community feeds, and topic-aware composer routing.'
    END
  ),
  updated_at = now()
WHERE slug IN (
  'commons-composer-ui',
  'community-browser-and-topic-views'
);
