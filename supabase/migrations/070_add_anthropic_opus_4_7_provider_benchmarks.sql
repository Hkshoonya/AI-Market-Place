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
VALUES
  (
    'research-agent',
    'Research Agent',
    'Anthropic internal multi-step research-agent benchmark.',
    'general',
    'absolute',
    0,
    100,
    true,
    'provider-benchmarks',
    'https://www.anthropic.com/news/claude-opus-4-7'
  ),
  (
    'finance-agent',
    'Finance Agent',
    'General Finance module from Anthropic''s internal research-agent benchmark.',
    'general',
    'absolute',
    0,
    100,
    true,
    'provider-benchmarks',
    'https://www.anthropic.com/news/claude-opus-4-7'
  ),
  (
    'biglaw-bench',
    'BigLaw Bench',
    'Legal reasoning and document analysis benchmark reported on the Anthropic Claude Opus 4.7 launch page.',
    'reasoning',
    'percentage',
    0,
    100,
    true,
    'provider-benchmarks',
    'https://www.anthropic.com/news/claude-opus-4-7'
  ),
  (
    'cursorbench',
    'CursorBench',
    'Coding benchmark reported by Cursor on the Anthropic Claude Opus 4.7 launch page.',
    'coding',
    'percentage',
    0,
    100,
    true,
    'provider-benchmarks',
    'https://www.anthropic.com/news/claude-opus-4-7'
  ),
  (
    'visual-acuity-benchmark',
    'Visual Acuity Benchmark',
    'Computer-use visual fidelity benchmark reported by XBOW on the Anthropic Claude Opus 4.7 launch page.',
    'general',
    'percentage',
    0,
    100,
    true,
    'provider-benchmarks',
    'https://www.anthropic.com/news/claude-opus-4-7'
  )
ON CONFLICT (slug) DO NOTHING;
