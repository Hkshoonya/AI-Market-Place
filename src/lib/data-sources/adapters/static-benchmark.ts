export const STATIC_BENCHMARK_ON_CONFLICT = "model_id,benchmark_id,model_version";

export function buildStaticBenchmarkScoreRecord(input: {
  modelId: string;
  benchmarkId: number;
  score: number;
  source: string;
  evaluationDate?: string | null;
}) {
  return {
    model_id: input.modelId,
    benchmark_id: input.benchmarkId,
    score: input.score,
    score_normalized: input.score,
    source: input.source,
    model_version: "",
    evaluation_date: input.evaluationDate ?? new Date().toISOString().split("T")[0],
  };
}
