-- Marketplace fees are now controlled by a runtime switch and default off.

UPDATE agent_deferred_items
SET
  status = 'done',
  notes = coalesce(notes, '{}'::jsonb) || jsonb_build_object(
    'completed_at', now(),
    'completed_by', 'engineering',
    'completion_note', 'Marketplace fees are now governed by ENABLE_MARKETPLACE_FEES and default to 0% until explicitly enabled.'
  ),
  updated_at = now()
WHERE slug = 'marketplace-fee-switch';
