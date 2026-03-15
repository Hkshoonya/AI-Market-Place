UPDATE agent_deferred_items
SET
  status = 'done',
  notes = COALESCE(notes, '{}'::jsonb) || jsonb_build_object(
    'completed_at', now(),
    'completed_by', 'codex',
    'result', 'preview manifests, order snapshots, order-manifest endpoint, and UI surfaces shipped'
  ),
  updated_at = now()
WHERE slug = 'protocol-native-fulfillment-manifests';
