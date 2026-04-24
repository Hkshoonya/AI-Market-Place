INSERT INTO benchmarks (
  slug,
  name,
  description,
  category,
  score_type,
  min_score,
  max_score,
  higher_is_better,
  source,
  source_url
)
VALUES (
  'aime',
  'AIME',
  'American Invitational Mathematics Examination benchmark.',
  'math',
  'percentage',
  0,
  100,
  true,
  'provider-benchmarks',
  'https://huggingface.co/zai-org/GLM-5.1'
)
ON CONFLICT (slug) DO NOTHING;
