/**
 * Expert Consensus Score Calculator (Lens 3)
 *
 * "What would AI researchers agree on?"
 *
 * Formula:
 *   expertScore = benchmarks * 0.35 + elo * 0.25
 *               + communitySignal * 0.20
 *               + citationProxy * 0.10
 *               + recency * 0.10
 */

export interface ExpertInputs {
  avgBenchmarkScore: number | null;
  benchmarkScores: Array<{ slug: string; score: number }> | null;
  eloScore: number | null;
  hfLikes: number | null;
  githubStars: number | null;
  newsMentions: number;
  providerAvgBenchmark: number | null;
  releaseDate: string | null;
  isOpenWeights: boolean;
}

export interface ExpertNormStats {
  maxLikes: number;
  maxStars: number;
  maxNewsMentions: number;
}

const BENCHMARK_IMPORTANCE: Record<string, number> = {
  "mmlu": 1.0, "humaneval": 1.2, "math": 1.1, "math-benchmark": 1.1,
  "gpqa": 1.3, "ifeval": 0.9, "bbh": 1.0, "musr": 0.8, "mmlu-pro": 1.2,
  "swe-bench": 1.3, "swe_bench": 1.3, "hellaswag": 0.8, "truthfulqa": 0.9,
  "livebench-reasoning": 1.1, "livebench-coding": 1.2, "mmmu": 1.0,
  "mathvista": 1.0, "bigcodebench": 1.2,
};

function weightedBenchmarkAvg(scores: Array<{ slug: string; score: number }>): number {
  if (scores.length === 0) return 0;
  let wSum = 0, wTotal = 0;
  for (const s of scores) {
    const norm = s.slug.toLowerCase().replace(/_/g, "-");
    const imp = BENCHMARK_IMPORTANCE[s.slug] ?? BENCHMARK_IMPORTANCE[norm] ?? 1.0;
    wSum += s.score * imp;
    wTotal += imp;
  }
  return wTotal > 0 ? wSum / wTotal : 0;
}

function logNorm(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.min((Math.log10(value + 1) / Math.log10(max + 1)) * 100, 100);
}

export function computeExpertNormStats(
  models: Array<{ hfLikes: number; githubStars: number; newsMentions: number }>
): ExpertNormStats {
  let maxLikes = 1, maxStars = 1, maxNewsMentions = 1;
  for (const m of models) {
    if (m.hfLikes > maxLikes) maxLikes = m.hfLikes;
    if (m.githubStars > maxStars) maxStars = m.githubStars;
    if (m.newsMentions > maxNewsMentions) maxNewsMentions = m.newsMentions;
  }
  return { maxLikes, maxStars, maxNewsMentions };
}

/**
 * Compute expert consensus score for a single model.
 *
 * Coverage penalty (discrete steps):
 *   0 evidence signals -> 0 (unranked)
 *   1 -> 0.40, 2 -> 0.65, 3 -> 0.85, 4+ -> 1.00
 */
export function computeExpertScore(
  inputs: ExpertInputs,
  stats: ExpertNormStats
): number {
  let benchScore = 0;
  if (inputs.benchmarkScores && inputs.benchmarkScores.length > 0) {
    benchScore = weightedBenchmarkAvg(inputs.benchmarkScores);
  } else if (inputs.avgBenchmarkScore != null && inputs.avgBenchmarkScore > 0) {
    benchScore = inputs.avgBenchmarkScore;
  }

  let eloNorm = 0;
  if (inputs.eloScore != null && inputs.eloScore > 0) {
    eloNorm = Math.min(Math.max((inputs.eloScore - 800) / (1400 - 800) * 100, 0), 100);
  }

  const likesNorm = inputs.hfLikes ? logNorm(inputs.hfLikes, stats.maxLikes) : 0;
  const starsNorm = inputs.githubStars ? logNorm(inputs.githubStars, stats.maxStars) : 0;
  const newsNorm = inputs.newsMentions > 0 ? logNorm(inputs.newsMentions, stats.maxNewsMentions) : 0;

  const communityParts: number[] = [];
  if (likesNorm > 0) communityParts.push(likesNorm);
  if (starsNorm > 0) communityParts.push(starsNorm);
  if (newsNorm > 0) communityParts.push(newsNorm);
  const communitySignal = communityParts.length > 0
    ? communityParts.reduce((a, b) => a + b, 0) / communityParts.length
    : 0;

  let citationProxy = 0;
  if (inputs.providerAvgBenchmark != null && inputs.providerAvgBenchmark > 0) {
    citationProxy = Math.min(inputs.providerAvgBenchmark / 80 * 100, 100);
  }

  let recency = 50;
  if (inputs.releaseDate) {
    const ageMs = Date.now() - new Date(inputs.releaseDate).getTime();
    const ageMonths = ageMs / (30 * 24 * 60 * 60 * 1000);
    recency = Math.max(100 * Math.exp(-ageMonths / 12), 10);
  }

  let bWeight = 0.35, eWeight = 0.25;
  const cWeight = 0.20, ciWeight = 0.10, rWeight = 0.10;

  if (benchScore <= 0 && eloNorm > 0) { eWeight += bWeight; bWeight = 0; }
  if (eloNorm <= 0 && benchScore > 0) { bWeight += eWeight; eWeight = 0; }

  const rawScore = benchScore * bWeight + eloNorm * eWeight
                 + communitySignal * cWeight + citationProxy * ciWeight
                 + recency * rWeight;

  let evidenceCount = 0;
  if (benchScore > 0) evidenceCount++;
  if (eloNorm > 0) evidenceCount++;
  if (communitySignal > 0) evidenceCount++;
  if (citationProxy > 0) evidenceCount++;

  let penalty: number;
  if (evidenceCount === 0) return 0;
  else if (evidenceCount === 1) penalty = 0.40;
  else if (evidenceCount === 2) penalty = 0.65;
  else if (evidenceCount === 3) penalty = 0.85;
  else penalty = 1.00;

  const score = rawScore * penalty;
  return Math.round(Math.min(Math.max(score, 0), 100) * 10) / 10;
}
