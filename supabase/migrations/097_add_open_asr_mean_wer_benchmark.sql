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
  'open-asr-mean-wer',
  'Open ASR Mean WER',
  'Mean word error rate aggregated across public speech-recognition datasets by the Hugging Face Open ASR Leaderboard.',
  'speech_audio',
  'wer',
  0,
  100,
  false,
  'open-asr-leaderboard',
  'https://huggingface.co/spaces/hf-audio/open_asr_leaderboard'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  score_type = EXCLUDED.score_type,
  min_score = EXCLUDED.min_score,
  max_score = EXCLUDED.max_score,
  higher_is_better = EXCLUDED.higher_is_better,
  source = EXCLUDED.source,
  source_url = EXCLUDED.source_url,
  is_active = true;
