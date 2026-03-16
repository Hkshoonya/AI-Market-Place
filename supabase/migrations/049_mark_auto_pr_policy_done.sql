UPDATE agent_deferred_items
SET
  status = 'done',
  notes = COALESCE(notes, '{}'::jsonb) || jsonb_build_object(
    'completed_at', NOW(),
    'completed_by', 'codex',
    'completion_note', 'Code-quality issues now carry deterministic draft_candidate/manual_only/blocked proposal metadata, and the admin agents dashboard surfaces the policy without enabling automatic code pushes.'
  ),
  updated_at = NOW()
WHERE slug = 'auto-pr-policy';
