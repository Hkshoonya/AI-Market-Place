BEGIN;

-- Keep the records and provenance, but exclude known cross-version attribution
-- from trusted rankings. A later verified sync can replace these scores normally.
UPDATE public.benchmark_scores AS score
SET source = 'provider-benchmarks-unverified',
    metadata = coalesce(score.metadata, '{}'::jsonb) || jsonb_build_object(
      'original_source', score.source,
      'quarantine_reason', 'Fable 5 evaluation was attributed to Fable 5.1 by loose alias matching',
      'quarantined_at', now()
    )
FROM public.models AS model
WHERE score.model_id = model.id
  AND model.slug = 'anthropic-claude-fable-5-1'
  AND score.source = 'provider-benchmarks'
  AND score.metadata->>'source_key' = 'anthropic-claude-fable-5';

COMMIT;
