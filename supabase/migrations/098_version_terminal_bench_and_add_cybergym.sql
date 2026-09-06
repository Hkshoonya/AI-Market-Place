BEGIN;

INSERT INTO benchmarks (slug, name, description, category, score_type, min_score, max_score, higher_is_better, source, source_url, is_active)
VALUES
  ('terminal-bench-2-1', 'Terminal-Bench 2.1', 'Terminal agent task resolution rate on version 2.1. Not comparable to version 2.0.', 'coding', 'percentage', 0, 100, true, 'provider-benchmarks', 'https://www.tbench.ai/?version=2.1', true),
  ('terminal-bench-3', 'Terminal-Bench 3.0', 'Terminal agent task resolution rate on version 3.0. Not comparable to earlier versions.', 'coding', 'percentage', 0, 100, true, 'provider-benchmarks', 'https://www.tbench.ai/?version=3.0', true),
  ('terminal-bench-4', 'Terminal-Bench 4.0', 'Terminal agent task resolution rate on version 4.0. Not comparable to earlier versions.', 'coding', 'percentage', 0, 100, true, 'provider-benchmarks', 'https://www.tbench.ai/?version=4.0', true),
  ('cybergym', 'CyberGym', 'Real-world vulnerability reproduction success rate. Provider-reported results retain source provenance.', 'coding', 'percentage', 0, 100, true, 'provider-benchmarks', 'https://www.cybergym.io/cybergym/', true)
ON CONFLICT (slug) DO NOTHING;

-- Retain explicitly versioned evidence under the correct benchmark identity.
INSERT INTO benchmark_scores (model_id, benchmark_id, score, score_normalized, evaluation_date, model_version, source, source_url, metadata)
SELECT s.model_id, target.id, s.score, s.score_normalized, s.evaluation_date, s.model_version, s.source, s.source_url, s.metadata
FROM benchmark_scores s
JOIN benchmarks original ON original.id = s.benchmark_id AND original.slug = 'terminal-bench'
CROSS JOIN benchmarks target
WHERE target.slug = 'terminal-bench-2-1' AND s.source = 'provider-benchmarks'
  AND s.metadata->>'matched_label' ~* 'terminal[-_ ]?bench[ _-]*2[.]1'
ON CONFLICT (model_id, benchmark_id, model_version) DO NOTHING;

DELETE FROM benchmark_scores s USING benchmarks b
WHERE s.benchmark_id = b.id AND b.slug = 'terminal-bench' AND s.source = 'provider-benchmarks'
  AND s.metadata->>'matched_label' ~* 'terminal[-_ ]?bench[ _-]*2[.]1';

COMMIT;
