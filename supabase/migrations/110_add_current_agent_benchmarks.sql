BEGIN;

-- Definitions only. Scores must come from source-linked, model-matched evidence.
INSERT INTO public.benchmarks
  (slug, name, description, category, score_type, min_score, max_score,
   higher_is_better, source, source_url, is_active)
VALUES
  ('deepswe-1-1', 'DeepSWE v1.1',
   'Long-horizon software engineering task resolution on DeepSWE v1.1. Provider-reported results retain their evaluation source and harness context.',
   'coding', 'percentage', 0, 100, true, 'provider-benchmarks',
   'https://huggingface.co/datasets/datacurve/deep-swe', true),
  ('toolathlon-verified', 'Toolathlon Verified',
   'Task success on the verified Toolathlon release. Distinct from unverified or earlier task sets; provider-reported results retain source provenance.',
   'agent', 'percentage', 0, 100, true, 'provider-benchmarks',
   'https://huggingface.co/datasets/hkust-nlp/Toolathlon', true)
ON CONFLICT (slug) DO NOTHING;

COMMIT;
