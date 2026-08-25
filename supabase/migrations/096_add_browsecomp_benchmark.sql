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
  'browsecomp',
  'BrowseComp',
  'Agentic web-research benchmark for finding difficult, verifiable information on the public web.',
  'general',
  'percentage',
  0,
  100,
  true,
  'provider-benchmarks',
  'https://arxiv.org/abs/2504.12516'
)
ON CONFLICT (slug) DO NOTHING;
