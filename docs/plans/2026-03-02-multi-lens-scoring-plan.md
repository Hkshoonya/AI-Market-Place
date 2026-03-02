# Multi-Lens Scoring & Ranking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the single overall_rank with 4 independent ranking lenses (Capability, Usage, Expert Consensus, Balanced), fix coverage penalty / open-proprietary bias / market cap formula / category ranking bugs, add tiered pipeline sync and health monitoring.

**Architecture:** Each lens is a standalone calculator function producing a 0-100 score. The cron job computes all 4 lenses per model, stores scores + ranks in new DB columns, and the API/UI expose a `lens` parameter for switching views. The data pipeline gets tiered sync intervals and health tracking.

**Tech Stack:** TypeScript, Next.js (App Router), Supabase (Postgres + pg_cron), TanStack Table (UI)

---

## Task 1: Database Migration — Add Lens Columns

**Files:**
- Create: `supabase/migrations/014_multi_lens_scoring.sql`
- Modify: `src/types/database.ts:20-62` (Model interface)
- Modify: `src/types/database.ts:173-185` (ModelSnapshot interface)

**Step 1: Write the migration SQL**

Create `supabase/migrations/014_multi_lens_scoring.sql`:

```sql
-- Multi-Lens Scoring: add score + rank columns per lens

-- New lens columns on models
ALTER TABLE models ADD COLUMN IF NOT EXISTS capability_score NUMERIC;
ALTER TABLE models ADD COLUMN IF NOT EXISTS capability_rank INT;
ALTER TABLE models ADD COLUMN IF NOT EXISTS usage_score NUMERIC;
ALTER TABLE models ADD COLUMN IF NOT EXISTS usage_rank INT;
ALTER TABLE models ADD COLUMN IF NOT EXISTS expert_score NUMERIC;
ALTER TABLE models ADD COLUMN IF NOT EXISTS expert_rank INT;
ALTER TABLE models ADD COLUMN IF NOT EXISTS balanced_rank INT;

-- Indexes for sorting by each lens
CREATE INDEX IF NOT EXISTS idx_models_capability_rank ON models (capability_rank) WHERE capability_rank IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_models_usage_rank ON models (usage_rank) WHERE usage_rank IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_models_expert_rank ON models (expert_rank) WHERE expert_rank IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_models_balanced_rank ON models (balanced_rank) WHERE balanced_rank IS NOT NULL;

-- New snapshot columns for trend tracking
ALTER TABLE model_snapshots ADD COLUMN IF NOT EXISTS capability_score NUMERIC;
ALTER TABLE model_snapshots ADD COLUMN IF NOT EXISTS usage_score NUMERIC;
ALTER TABLE model_snapshots ADD COLUMN IF NOT EXISTS expert_score NUMERIC;
ALTER TABLE model_snapshots ADD COLUMN IF NOT EXISTS signal_coverage JSONB;

-- Pipeline health table
CREATE TABLE IF NOT EXISTS pipeline_health (
  source_slug TEXT PRIMARY KEY,
  last_success_at TIMESTAMPTZ,
  consecutive_failures INT DEFAULT 0,
  expected_interval_hours INT NOT NULL DEFAULT 6,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed pipeline_health from existing data_sources
INSERT INTO pipeline_health (source_slug, last_success_at, expected_interval_hours)
SELECT slug, last_sync_at, sync_interval_hours
FROM data_sources
WHERE is_enabled = true
ON CONFLICT (source_slug) DO NOTHING;
```

**Step 2: Update TypeScript types**

Add to the `Model` interface in `src/types/database.ts` after line 58 (`agent_rank`):

```typescript
  capability_score: number | null;
  capability_rank: number | null;
  usage_score: number | null;
  usage_rank: number | null;
  expert_score: number | null;
  expert_rank: number | null;
  balanced_rank: number | null;
```

Add to the `ModelSnapshot` interface after line 183 (`agent_score`):

```typescript
  capability_score: number | null;
  usage_score: number | null;
  expert_score: number | null;
  signal_coverage: Record<string, boolean> | null;
```

**Step 3: Commit**

```bash
git add supabase/migrations/014_multi_lens_scoring.sql src/types/database.ts
git commit -m "feat: add multi-lens scoring DB columns and pipeline_health table"
```

---

## Task 2: Capability Score Calculator

**Files:**
- Create: `src/lib/scoring/capability-calculator.ts`

**Step 1: Create the calculator**

Create `src/lib/scoring/capability-calculator.ts`:

```typescript
/**
 * Capability Score Calculator (Lens 1)
 *
 * Pure performance ranking based on benchmarks + ELO + recency.
 * No popularity, market, or community signals.
 *
 * Formula:
 *   capabilityScore = weightedBenchmarks * 0.60 + normalizedELO * 0.30 + recencyBonus * 0.10
 *
 * Models with ZERO benchmarks AND zero ELO are unranked (null).
 */

export interface CapabilityInputs {
  benchmarkScores: Array<{ slug: string; score: number }> | null;
  eloScore: number | null;
  releaseDate: string | null;
  category: string;
}

/**
 * Category-specific benchmark groupings.
 * Primary benchmarks get 70% of the benchmark sub-weight; secondary get 30%.
 */
const CATEGORY_BENCHMARKS: Record<string, { primary: string[]; secondary: string[] }> = {
  llm: {
    primary: ["mmlu", "mmlu-pro", "gpqa", "math", "math-benchmark", "bbh"],
    secondary: ["ifeval", "hellaswag", "truthfulqa"],
  },
  code: {
    primary: ["humaneval", "swe-bench", "swe_bench", "bigcodebench"],
    secondary: ["livebench-coding"],
  },
  multimodal: {
    primary: ["mmmu", "mathvista", "ocrbench"],
    secondary: ["mmlu", "gpqa"],
  },
  image_generation: {
    primary: [], // Image gen relies almost entirely on ELO
    secondary: [],
  },
  agentic_browser: {
    primary: ["swe-bench", "swe_bench", "terminal-bench", "terminal_bench", "os-world", "os_world"],
    secondary: ["gaia", "webarena", "web-arena", "tau-bench", "tau_bench"],
  },
};

function getCategoryBenchmarks(category: string) {
  return CATEGORY_BENCHMARKS[category] ?? CATEGORY_BENCHMARKS.llm;
}

function computeCategoryWeightedBenchmarks(
  scores: Array<{ slug: string; score: number }>,
  category: string
): number {
  const { primary, secondary } = getCategoryBenchmarks(category);

  const primaryScores: number[] = [];
  const secondaryScores: number[] = [];
  const otherScores: number[] = [];

  for (const s of scores) {
    const normalized = s.slug.toLowerCase().replace(/_/g, "-");
    if (primary.includes(s.slug) || primary.includes(normalized)) {
      primaryScores.push(s.score);
    } else if (secondary.includes(s.slug) || secondary.includes(normalized)) {
      secondaryScores.push(s.score);
    } else {
      otherScores.push(s.score);
    }
  }

  // If no primary/secondary distinction (like image_gen), use all scores equally
  if (primary.length === 0 && secondary.length === 0) {
    const all = [...primaryScores, ...secondaryScores, ...otherScores];
    if (all.length === 0) return 0;
    return all.reduce((a, b) => a + b, 0) / all.length;
  }

  // Weighted: primary 70%, secondary 30%
  const pAvg = primaryScores.length > 0
    ? primaryScores.reduce((a, b) => a + b, 0) / primaryScores.length
    : null;
  const sAvg = secondaryScores.length > 0
    ? secondaryScores.reduce((a, b) => a + b, 0) / secondaryScores.length
    : (otherScores.length > 0 ? otherScores.reduce((a, b) => a + b, 0) / otherScores.length : null);

  if (pAvg != null && sAvg != null) return pAvg * 0.7 + sAvg * 0.3;
  if (pAvg != null) return pAvg;
  if (sAvg != null) return sAvg;
  return 0;
}

/**
 * Compute capability score for a single model.
 * Returns null if model has no benchmarks AND no ELO (unranked).
 */
export function computeCapabilityScore(inputs: CapabilityInputs): number | null {
  const hasBenchmarks = inputs.benchmarkScores != null && inputs.benchmarkScores.length > 0;
  const hasELO = inputs.eloScore != null && inputs.eloScore > 0;

  // Gate: must have at least one quality signal
  if (!hasBenchmarks && !hasELO) return null;

  // Benchmark sub-score (0-100)
  let benchmarkScore = 0;
  if (hasBenchmarks) {
    benchmarkScore = computeCategoryWeightedBenchmarks(inputs.benchmarkScores!, inputs.category);
  }

  // ELO sub-score (0-100), normalized from 800-1400 range
  let eloNormalized = 0;
  if (hasELO) {
    eloNormalized = Math.min(Math.max((inputs.eloScore! - 800) / (1400 - 800) * 100, 0), 100);
  }

  // Recency bonus (0-100), exponential decay with 12-month half-life
  let recencyBonus = 50; // default if no release date
  if (inputs.releaseDate) {
    const ageMs = Date.now() - new Date(inputs.releaseDate).getTime();
    const ageMonths = ageMs / (30 * 24 * 60 * 60 * 1000);
    recencyBonus = Math.max(100 * Math.exp(-ageMonths / 12), 10);
  }

  // Weight distribution
  let benchWeight = 0.60;
  let eloWeight = 0.30;
  const recencyWeight = 0.10;

  // If no benchmarks, ELO absorbs benchmark weight
  if (!hasBenchmarks && hasELO) {
    eloWeight += benchWeight;
    benchWeight = 0;
  }
  // If no ELO, benchmarks absorb ELO weight
  if (hasBenchmarks && !hasELO) {
    benchWeight += eloWeight;
    eloWeight = 0;
  }

  const score = benchmarkScore * benchWeight
              + eloNormalized * eloWeight
              + recencyBonus * recencyWeight;

  return Math.round(Math.min(Math.max(score, 0), 100) * 10) / 10;
}
```

**Step 2: Commit**

```bash
git add src/lib/scoring/capability-calculator.ts
git commit -m "feat: add capability score calculator (Lens 1)"
```

---

## Task 3: Usage Score Calculator

**Files:**
- Create: `src/lib/scoring/usage-calculator.ts`

**Step 1: Create the calculator**

Create `src/lib/scoring/usage-calculator.ts`:

```typescript
/**
 * Usage Score Calculator (Lens 2)
 *
 * Adoption-weighted ranking: "What are people actually using?"
 *
 * Formula:
 *   usageScore = downloads * 0.30 + providerMAU * 0.20 + stars * 0.15
 *              + news * 0.15 + trending * 0.10 + likes * 0.10
 *
 * Key design: separate normalization pools for open vs proprietary models.
 * No coverage penalty — missing signals contribute 0, remaining reweighted.
 */

export interface UsageInputs {
  downloads: number;
  likes: number;
  stars: number;
  newsMentions: number;
  providerUsageEstimate: number;
  trendingScore: number;
  isOpenWeights: boolean;
}

export interface UsageNormStats {
  // Open model pool
  openMaxDownloads: number;
  openMaxLikes: number;
  openMaxStars: number;
  openMaxTrending: number;
  // Proprietary model pool
  propMaxMAU: number;
  propMaxNews: number;
  propMaxTrending: number;
  // Shared (used for both pools)
  maxNews: number;
}

const WEIGHTS = {
  downloads: 0.30,
  likes: 0.10,
  stars: 0.15,
  news: 0.15,
  usage: 0.20,
  trending: 0.10,
};

function logNorm(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.min((Math.log10(value + 1) / Math.log10(max + 1)) * 100, 100);
}

/**
 * Compute normalization stats with separate pools for open vs proprietary.
 */
export function computeUsageNormStats(
  models: Array<UsageInputs>
): UsageNormStats {
  const stats: UsageNormStats = {
    openMaxDownloads: 1, openMaxLikes: 1, openMaxStars: 1, openMaxTrending: 1,
    propMaxMAU: 1, propMaxNews: 1, propMaxTrending: 1,
    maxNews: 1,
  };

  for (const m of models) {
    if (m.newsMentions > stats.maxNews) stats.maxNews = m.newsMentions;

    if (m.isOpenWeights) {
      if (m.downloads > stats.openMaxDownloads) stats.openMaxDownloads = m.downloads;
      if (m.likes > stats.openMaxLikes) stats.openMaxLikes = m.likes;
      if (m.stars > stats.openMaxStars) stats.openMaxStars = m.stars;
      if (m.trendingScore > stats.openMaxTrending) stats.openMaxTrending = m.trendingScore;
    } else {
      if (m.providerUsageEstimate > stats.propMaxMAU) stats.propMaxMAU = m.providerUsageEstimate;
      if (m.newsMentions > stats.propMaxNews) stats.propMaxNews = m.newsMentions;
      if (m.trendingScore > stats.propMaxTrending) stats.propMaxTrending = m.trendingScore;
    }
  }

  return stats;
}

/**
 * Compute usage score for a single model.
 * Separate normalization for open vs proprietary.
 * No coverage penalty — missing signals reweighted proportionally.
 */
export function computeUsageScore(
  inputs: UsageInputs,
  stats: UsageNormStats
): number {
  const signals: Array<{ score: number; weight: number }> = [];

  if (inputs.isOpenWeights) {
    // Open model signals
    if (inputs.downloads > 0) {
      signals.push({ score: logNorm(inputs.downloads, stats.openMaxDownloads), weight: WEIGHTS.downloads });
    }
    if (inputs.likes > 0) {
      signals.push({ score: logNorm(inputs.likes, stats.openMaxLikes), weight: WEIGHTS.likes });
    }
    if (inputs.stars > 0) {
      signals.push({ score: logNorm(inputs.stars, stats.openMaxStars), weight: WEIGHTS.stars });
    }
    if (inputs.trendingScore > 0) {
      const norm = stats.openMaxTrending > 0 ? (inputs.trendingScore / stats.openMaxTrending) * 100 : 0;
      signals.push({ score: Math.min(norm, 100), weight: WEIGHTS.trending });
    }
    // Open models can also have news
    if (inputs.newsMentions > 0) {
      signals.push({ score: logNorm(inputs.newsMentions, stats.maxNews), weight: WEIGHTS.news });
    }
    // Provider MAU still applies (e.g., Meta's LLaMA has Meta's MAU)
    if (inputs.providerUsageEstimate > 0) {
      signals.push({ score: logNorm(inputs.providerUsageEstimate, stats.propMaxMAU), weight: WEIGHTS.usage });
    }
  } else {
    // Proprietary model signals
    if (inputs.providerUsageEstimate > 0) {
      signals.push({ score: logNorm(inputs.providerUsageEstimate, stats.propMaxMAU), weight: WEIGHTS.usage });
    }
    if (inputs.newsMentions > 0) {
      signals.push({ score: logNorm(inputs.newsMentions, stats.propMaxNews), weight: WEIGHTS.news });
    }
    if (inputs.trendingScore > 0) {
      const norm = stats.propMaxTrending > 0 ? (inputs.trendingScore / stats.propMaxTrending) * 100 : 0;
      signals.push({ score: Math.min(norm, 100), weight: WEIGHTS.trending });
    }
    // Proprietary models might have HF downloads (rare but possible)
    if (inputs.downloads > 0) {
      signals.push({ score: logNorm(inputs.downloads, stats.openMaxDownloads), weight: WEIGHTS.downloads });
    }
    if (inputs.likes > 0) {
      signals.push({ score: logNorm(inputs.likes, stats.openMaxLikes), weight: WEIGHTS.likes });
    }
    if (inputs.stars > 0) {
      signals.push({ score: logNorm(inputs.stars, stats.openMaxStars), weight: WEIGHTS.stars });
    }
  }

  if (signals.length === 0) return 0;

  // Reweight proportionally — no coverage penalty
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  const score = signals.reduce((sum, s) => sum + s.score * (s.weight / totalWeight), 0);

  return Math.round(Math.min(score, 100) * 10) / 10;
}
```

**Step 2: Commit**

```bash
git add src/lib/scoring/usage-calculator.ts
git commit -m "feat: add usage score calculator with split normalization (Lens 2)"
```

---

## Task 4: Expert Consensus Calculator

**Files:**
- Create: `src/lib/scoring/expert-calculator.ts`

**Step 1: Create the calculator**

Create `src/lib/scoring/expert-calculator.ts`:

```typescript
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
  /** Weighted benchmark average (0-100, null if no benchmarks) */
  avgBenchmarkScore: number | null;
  benchmarkScores: Array<{ slug: string; score: number }> | null;
  /** Chatbot Arena ELO */
  eloScore: number | null;
  /** HuggingFace likes (researcher endorsement) */
  hfLikes: number | null;
  /** GitHub stars (developer endorsement) */
  githubStars: number | null;
  /** News mentions last 30d */
  newsMentions: number;
  /** Provider avg benchmark (proxy for citation/reputation) */
  providerAvgBenchmark: number | null;
  /** Release date for recency */
  releaseDate: string | null;
  /** Whether model has open weights */
  isOpenWeights: boolean;
}

export interface ExpertNormStats {
  maxLikes: number;
  maxStars: number;
  maxNewsMentions: number;
}

/**
 * Benchmark importance weights (same as quality-calculator but used for expert lens).
 */
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
 *   0 evidence signals → 0 (unranked)
 *   1 → 0.40, 2 → 0.65, 3 → 0.85, 4+ → 1.00
 */
export function computeExpertScore(
  inputs: ExpertInputs,
  stats: ExpertNormStats
): number {
  // 1. Benchmarks (0-100)
  let benchScore = 0;
  if (inputs.benchmarkScores && inputs.benchmarkScores.length > 0) {
    benchScore = weightedBenchmarkAvg(inputs.benchmarkScores);
  } else if (inputs.avgBenchmarkScore != null && inputs.avgBenchmarkScore > 0) {
    benchScore = inputs.avgBenchmarkScore;
  }

  // 2. ELO (0-100)
  let eloNorm = 0;
  if (inputs.eloScore != null && inputs.eloScore > 0) {
    eloNorm = Math.min(Math.max((inputs.eloScore - 800) / (1400 - 800) * 100, 0), 100);
  }

  // 3. Community signal (0-100): blend of likes, stars, news
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

  // 4. Citation proxy (0-100): provider reputation
  let citationProxy = 0;
  if (inputs.providerAvgBenchmark != null && inputs.providerAvgBenchmark > 0) {
    citationProxy = Math.min(inputs.providerAvgBenchmark / 80 * 100, 100);
  }

  // 5. Recency (0-100)
  let recency = 50;
  if (inputs.releaseDate) {
    const ageMs = Date.now() - new Date(inputs.releaseDate).getTime();
    const ageMonths = ageMs / (30 * 24 * 60 * 60 * 1000);
    recency = Math.max(100 * Math.exp(-ageMonths / 12), 10);
  }

  // Weight distribution (benchmarks 35%, elo 25%, community 20%, citation 10%, recency 10%)
  let bWeight = 0.35, eWeight = 0.25;
  const cWeight = 0.20, ciWeight = 0.10, rWeight = 0.10;

  // If no benchmarks, ELO absorbs
  if (benchScore <= 0 && eloNorm > 0) {
    eWeight += bWeight;
    bWeight = 0;
  }
  // If no ELO, benchmarks absorb
  if (eloNorm <= 0 && benchScore > 0) {
    bWeight += eWeight;
    eWeight = 0;
  }

  const rawScore = benchScore * bWeight + eloNorm * eWeight
                 + communitySignal * cWeight + citationProxy * ciWeight
                 + recency * rWeight;

  // Coverage penalty (discrete steps)
  // Evidence signals: benchmarks, elo, community (any of likes/stars/news), citation proxy
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
```

**Step 2: Commit**

```bash
git add src/lib/scoring/expert-calculator.ts
git commit -m "feat: add expert consensus calculator with coverage penalty (Lens 3)"
```

---

## Task 5: Fix Market Cap Formula

**Files:**
- Modify: `src/lib/scoring/market-cap-calculator.ts:228-248` (computeMarketCap function)

**Step 1: Update the market cap function**

In `src/lib/scoring/market-cap-calculator.ts`, replace the `computeMarketCap` function (lines 228-248):

```typescript
/**
 * Compute an estimated "market cap" representing monthly revenue potential.
 *
 * Revised formula:
 *   marketCap = adoptionScore^1.2 * priceWeight * SCALE_FACTOR
 *
 * Where:
 *   - adoptionScore = usage lens score (0-100)
 *   - priceWeight = log10(blendedPrice + 1) / log10(20 + 1) — log-normalized
 *   - SCALE_FACTOR calibrated so GPT-4o ≈ $200M/month
 *
 * @param usageScore - 0-100 usage lens score (replaces raw popularityScore)
 * @param blendedApiPrice - Average of input + output price per 1M tokens (USD)
 * @returns Estimated monthly revenue in USD
 */
export function computeMarketCap(
  usageScore: number,
  blendedApiPrice: number
): number {
  if (usageScore <= 0) return 0;

  // Minimum effective price: $0.10 for free/open models (was $0.01)
  const effectivePrice = Math.max(blendedApiPrice, 0.10);

  // Log-normalize price so it matters but doesn't dominate
  // $0.10 → 0.08, $1 → 0.23, $5 → 0.53, $15 → 0.90, $20 → 1.0
  const priceWeight = Math.log10(effectivePrice + 1) / Math.log10(20 + 1);

  // Scale factor calibrated:
  // usage=95, price=$15 (GPT-4o) → 95^1.2 * 0.90 * 1300 ≈ $200M
  // usage=80, price=$5 (mid-tier) → 80^1.2 * 0.53 * 1300 ≈ $90M
  // usage=60, price=$1 (cheap)    → 60^1.2 * 0.23 * 1300 ≈ $30M
  const SCALE_FACTOR = 1300;

  const rawMarketCap =
    Math.pow(usageScore, 1.2) * priceWeight * SCALE_FACTOR;

  return Math.round(rawMarketCap / 1000) * 1000;
}
```

**Step 2: Commit**

```bash
git add src/lib/scoring/market-cap-calculator.ts
git commit -m "fix: revise market cap formula — exponent 1.2, log-normalized price, higher floor"
```

---

## Task 6: Balanced Ranking Calculator

**Files:**
- Create: `src/lib/scoring/balanced-calculator.ts`

**Step 1: Create the calculator**

Create `src/lib/scoring/balanced-calculator.ts`:

```typescript
/**
 * Balanced Ranking Calculator (Lens 4)
 *
 * Meta-ranking that blends the other 3 lenses plus value.
 *
 * Formula:
 *   balancedRank = capabilityRank * cW + usageRank * uW + expertRank * eW + valueRank * vW
 *
 * Category-specific weights ensure image gen doesn't get ranked by LLM-heavy signals.
 */

interface BalancedWeights {
  capability: number;
  usage: number;
  expert: number;
  value: number;
}

const CATEGORY_BALANCED_WEIGHTS: Record<string, BalancedWeights> = {
  llm:              { capability: 0.35, usage: 0.30, expert: 0.25, value: 0.10 },
  code:             { capability: 0.40, usage: 0.25, expert: 0.25, value: 0.10 },
  image_generation: { capability: 0.20, usage: 0.40, expert: 0.30, value: 0.10 },
  multimodal:       { capability: 0.35, usage: 0.30, expert: 0.25, value: 0.10 },
  agentic_browser:  { capability: 0.40, usage: 0.25, expert: 0.25, value: 0.10 },
  default:          { capability: 0.35, usage: 0.30, expert: 0.25, value: 0.10 },
};

interface ModelRanks {
  id: string;
  category: string;
  capabilityRank: number | null;  // null = unranked in capability
  usageRank: number;
  expertRank: number;
  valueRank: number | null;       // null = no pricing
}

/**
 * Compute balanced rankings for all models.
 * Unranked models (null capabilityRank) use worst-case rank for that signal.
 */
export function computeBalancedRankings(
  models: ModelRanks[]
): Array<{ id: string; balanced_rank: number; category_balanced_rank: number }> {
  const maxRank = models.length;

  // Compute composite score per model (lower = better)
  const scored = models.map((m) => {
    const w = CATEGORY_BALANCED_WEIGHTS[m.category] ?? CATEGORY_BALANCED_WEIGHTS.default;

    const capRank = m.capabilityRank ?? maxRank; // unranked → worst
    const valRank = m.valueRank ?? maxRank;      // no pricing → worst

    const composite = capRank * w.capability
                    + m.usageRank * w.usage
                    + m.expertRank * w.expert
                    + valRank * w.value;

    return { id: m.id, category: m.category, composite };
  });

  // Sort by composite (lower = better)
  scored.sort((a, b) => a.composite - b.composite);

  // Assign overall balanced rank
  const result = scored.map((m, i) => ({
    id: m.id,
    category: m.category,
    balanced_rank: i + 1,
    category_balanced_rank: 0,
  }));

  // Assign per-category balanced rank
  const groups = new Map<string, typeof result>();
  for (const m of result) {
    if (!groups.has(m.category)) groups.set(m.category, []);
    groups.get(m.category)!.push(m);
  }
  for (const group of groups.values()) {
    group.forEach((m, i) => { m.category_balanced_rank = i + 1; });
  }

  return result;
}
```

**Step 2: Commit**

```bash
git add src/lib/scoring/balanced-calculator.ts
git commit -m "feat: add balanced ranking calculator with category-specific weights (Lens 4)"
```

---

## Task 7: Pipeline Health Tracker

**Files:**
- Create: `src/lib/pipeline-health.ts`

**Step 1: Create the health tracker**

Create `src/lib/pipeline-health.ts`:

```typescript
/**
 * Pipeline Health Tracker
 *
 * Tracks data source sync health, detects stale sources,
 * and provides coverage reporting.
 */

import { createClient } from "@supabase/supabase-js";

interface PipelineHealthRecord {
  source_slug: string;
  last_success_at: string | null;
  consecutive_failures: number;
  expected_interval_hours: number;
}

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** Record a successful sync for a source */
export async function recordSyncSuccess(sourceSlug: string): Promise<void> {
  const sb = createServiceClient();
  await sb.from("pipeline_health").upsert({
    source_slug: sourceSlug,
    last_success_at: new Date().toISOString(),
    consecutive_failures: 0,
    updated_at: new Date().toISOString(),
  }, { onConflict: "source_slug" });
}

/** Record a failed sync for a source */
export async function recordSyncFailure(sourceSlug: string): Promise<void> {
  const sb = createServiceClient();

  // Increment consecutive_failures
  const { data: existing } = await sb
    .from("pipeline_health")
    .select("consecutive_failures")
    .eq("source_slug", sourceSlug)
    .single();

  const failures = (existing?.consecutive_failures ?? 0) + 1;

  await sb.from("pipeline_health").upsert({
    source_slug: sourceSlug,
    consecutive_failures: failures,
    updated_at: new Date().toISOString(),
  }, { onConflict: "source_slug" });
}

/** Get count of stale sources (not synced within 2x expected interval) */
export async function getStaleSourceCount(): Promise<number> {
  const sb = createServiceClient();

  const { data } = await sb
    .from("pipeline_health")
    .select("source_slug, last_success_at, expected_interval_hours");

  if (!data) return 0;

  const now = Date.now();
  let staleCount = 0;
  for (const row of data) {
    if (!row.last_success_at) { staleCount++; continue; }
    const lastSync = new Date(row.last_success_at).getTime();
    const maxAge = (row.expected_interval_hours ?? 6) * 2 * 60 * 60 * 1000;
    if (now - lastSync > maxAge) staleCount++;
  }

  return staleCount;
}

/** Build signal coverage map for a model */
export function buildSignalCoverage(signals: {
  hasBenchmarks: boolean;
  hasELO: boolean;
  hasDownloads: boolean;
  hasLikes: boolean;
  hasStars: boolean;
  hasNews: boolean;
  hasPricing: boolean;
}): Record<string, boolean> {
  return {
    benchmarks: signals.hasBenchmarks,
    elo: signals.hasELO,
    downloads: signals.hasDownloads,
    likes: signals.hasLikes,
    stars: signals.hasStars,
    news: signals.hasNews,
    pricing: signals.hasPricing,
  };
}
```

**Step 2: Commit**

```bash
git add src/lib/pipeline-health.ts
git commit -m "feat: add pipeline health tracker with stale detection"
```

---

## Task 8: Rewrite Compute-Scores Cron to Use All 4 Lenses

This is the largest task. The cron job at `src/app/api/cron/compute-scores/route.ts` must be updated to compute all 4 lens scores and write them to DB.

**Files:**
- Modify: `src/app/api/cron/compute-scores/route.ts` (full rewrite of scoring logic)

**Step 1: Add imports for new calculators**

At the top of `src/app/api/cron/compute-scores/route.ts`, replace the scoring imports (lines 1-22) with:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  calculateQualityScore,
  computeNormalizationStats,
  type QualityInputs,
} from "@/lib/scoring/quality-calculator";
import { computeCapabilityScore, type CapabilityInputs } from "@/lib/scoring/capability-calculator";
import { computeUsageScore, computeUsageNormStats, type UsageInputs } from "@/lib/scoring/usage-calculator";
import { computeExpertScore, computeExpertNormStats, type ExpertInputs } from "@/lib/scoring/expert-calculator";
import { computeBalancedRankings } from "@/lib/scoring/balanced-calculator";
import { lookupProviderPrice } from "@/lib/data-sources/adapters/provider-pricing";
import {
  computeAgentBenchmarkWeights,
  computeAgentScore,
  normalizeAgentSlug,
  type AgentBenchmarkScore,
} from "@/lib/scoring/agent-score-calculator";
import {
  computePopularityScore,
  computePopularityStats,
  computeMarketCap,
  getProviderUsageEstimate,
} from "@/lib/scoring/market-cap-calculator";
import { trackCronRun } from "@/lib/cron-tracker";
import { getStaleSourceCount, buildSignalCoverage } from "@/lib/pipeline-health";
```

**Step 2: After quality scores (line ~198), agent scores (~326), and popularity/market cap (~363), add the new lens computations**

Insert before the ranking computation (before line ~372 "// 6. Compute rankings"):

```typescript
    // --- LENS 1: Capability scores ---
    const capabilityScoreMap = new Map<string, number | null>();
    for (const m of models) {
      const capInputs: CapabilityInputs = {
        benchmarkScores: benchmarkDetailMap.get(m.id) ?? null,
        eloScore: eloMap.get(m.id) ?? null,
        releaseDate: m.release_date as string | null,
        category: (m.category as string) ?? "other",
      };
      capabilityScoreMap.set(m.id, computeCapabilityScore(capInputs));
    }

    // Capability ranks (only ranked models)
    const capRanked = Array.from(capabilityScoreMap.entries())
      .filter(([, score]) => score != null)
      .sort((a, b) => b[1]! - a[1]!)
      .map(([id], i) => ({ id, rank: i + 1 }));
    const capRankMap = new Map(capRanked.map(r => [r.id, r.rank]));

    // --- LENS 2: Usage scores (with split normalization) ---
    const usageInputsList: Array<UsageInputs & { id: string }> = models.map((m) => ({
      id: m.id,
      downloads: (m.hf_downloads as number) ?? 0,
      likes: (m.hf_likes as number) ?? 0,
      stars: (m.github_stars as number) ?? 0,
      newsMentions: newsMentionMap.get(m.id) ?? 0,
      providerUsageEstimate: getProviderUsageEstimate((m.provider as string) ?? ""),
      trendingScore: m.hf_trending_score ? Number(m.hf_trending_score) : 0,
      isOpenWeights: !!(m.is_open_weights),
    }));
    const usageNormStats = computeUsageNormStats(usageInputsList);
    const usageScoreMap = new Map<string, number>();
    for (const input of usageInputsList) {
      usageScoreMap.set(input.id, computeUsageScore(input, usageNormStats));
    }

    // Usage ranks
    const usageRanked = Array.from(usageScoreMap.entries())
      .filter(([, score]) => score > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([id], i) => ({ id, rank: i + 1 }));
    const usageRankMap = new Map(usageRanked.map(r => [r.id, r.rank]));

    // --- LENS 3: Expert consensus scores ---
    const expertNormInput = models.map((m) => ({
      hfLikes: (m.hf_likes as number) ?? 0,
      githubStars: (m.github_stars as number) ?? 0,
      newsMentions: newsMentionMap.get(m.id) ?? 0,
    }));
    const expertNormStats = computeExpertNormStats(expertNormInput);
    const expertScoreMap = new Map<string, number>();
    for (const m of models) {
      const benchScores = benchmarkMap.get(m.id);
      const avgBenchmark = benchScores && benchScores.length > 0
        ? benchScores.reduce((a, b) => a + b, 0) / benchScores.length
        : null;
      const provider = (m.provider as string) ?? "";

      const expertInputs: ExpertInputs = {
        avgBenchmarkScore: avgBenchmark,
        benchmarkScores: benchmarkDetailMap.get(m.id) ?? null,
        eloScore: eloMap.get(m.id) ?? null,
        hfLikes: (m.hf_likes as number) ?? null,
        githubStars: (m.github_stars as number) ?? null,
        newsMentions: newsMentionMap.get(m.id) ?? 0,
        providerAvgBenchmark: providerBenchmarkAvg.get(provider) ?? null,
        releaseDate: m.release_date as string | null,
        isOpenWeights: !!(m.is_open_weights),
      };
      expertScoreMap.set(m.id, computeExpertScore(expertInputs, expertNormStats));
    }

    // Expert ranks
    const expertRanked = Array.from(expertScoreMap.entries())
      .filter(([, score]) => score > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([id], i) => ({ id, rank: i + 1 }));
    const expertRankMap = new Map(expertRanked.map(r => [r.id, r.rank]));

    // --- Pipeline health check ---
    const staleCount = await getStaleSourceCount();
    if (staleCount > 3) {
      console.warn(`[compute-scores] WARNING: ${staleCount} data sources are stale`);
    }
```

**Step 3: Replace the ranking computation (line ~372-378)**

Replace `computeRankings` call with balanced ranking computation that uses the new value map:

```typescript
    // --- LENS 4: Balanced composite rankings ---
    const defaultRank = models.length;
    const balancedInput = models.map((m) => ({
      id: m.id,
      category: (m.category as string) ?? "other",
      capabilityRank: capRankMap.get(m.id) ?? null,
      usageRank: usageRankMap.get(m.id) ?? defaultRank,
      expertRank: expertRankMap.get(m.id) ?? defaultRank,
      valueRank: normalizedValueMap.has(m.id)
        ? (Array.from(normalizedValueMap.entries())
            .sort((a, b) => b[1] - a[1])
            .findIndex(([id]) => id === m.id) + 1) || null
        : null,
    }));
    const balancedRankings = computeBalancedRankings(balancedInput);
    const balancedRankMap = new Map(balancedRankings.map(r => [r.id, { overall: r.balanced_rank, category: r.category_balanced_rank }]));

    // Also compute legacy overall_rank from balanced for backward compat
    const rankMap = new Map(balancedRankings.map(r => [r.id, { overall_rank: r.balanced_rank, category_rank: r.category_balanced_rank }]));
```

**Step 4: Update the batch model update (line ~392-428)**

Add the new lens columns to the update payload:

```typescript
        // Lens scores
        const capScore = capabilityScoreMap.get(sm.id);
        if (capScore != null) {
          updateData.capability_score = capScore;
          updateData.capability_rank = capRankMap.get(sm.id) ?? null;
        }
        updateData.usage_score = usageScoreMap.get(sm.id) ?? 0;
        updateData.usage_rank = usageRankMap.get(sm.id) ?? null;
        updateData.expert_score = expertScoreMap.get(sm.id) ?? 0;
        updateData.expert_rank = expertRankMap.get(sm.id) ?? null;

        const balRank = balancedRankMap.get(sm.id);
        if (balRank) {
          updateData.balanced_rank = balRank.overall;
          updateData.overall_rank = balRank.overall; // backward compat
          updateData.category_rank = balRank.category;
        }
```

**Step 5: Update snapshot creation (line ~446-464)**

Add lens scores and signal coverage to snapshots:

```typescript
        const signalCoverage = buildSignalCoverage({
          hasBenchmarks: benchmarkMap.has(sm.id),
          hasELO: eloMap.has(sm.id),
          hasDownloads: !!m.hf_downloads,
          hasLikes: !!m.hf_likes,
          hasStars: !!m.github_stars,
          hasNews: (newsMentionMap.get(sm.id) ?? 0) > 0,
          hasPricing: cheapestPriceMap.has(sm.id),
        });

        return supabase.from("model_snapshots").upsert(
          {
            model_id: sm.id,
            snapshot_date: today,
            quality_score: sm.qualityScore,
            hf_downloads: m.hf_downloads,
            hf_likes: m.hf_likes,
            overall_rank: balRank?.overall ?? null,
            popularity_score: popularityMap.get(sm.id) ?? null,
            market_cap_estimate: marketCapMap.get(sm.id) ?? null,
            agent_score: agentScoreMap.get(sm.id) ?? null,
            capability_score: capabilityScoreMap.get(sm.id) ?? null,
            usage_score: usageScoreMap.get(sm.id) ?? null,
            expert_score: expertScoreMap.get(sm.id) ?? null,
            signal_coverage: signalCoverage,
          },
          { onConflict: "model_id,snapshot_date" }
        ).then(({ error }) => ({ error, skipped: false }));
```

**Step 6: Update the market cap computation to use usage score instead of popularity**

Find the market cap computation section and change it to pass `usageScore` instead of `popScore`:

```typescript
      // Market cap now uses usage lens score (not raw popularity)
      const uScore = usageScoreMap.get(input.id) ?? 0;
      const mktCap = computeMarketCap(uScore, blendedPrice);
```

**Step 7: Commit**

```bash
git add src/app/api/cron/compute-scores/route.ts
git commit -m "feat: compute all 4 ranking lenses in scoring cron"
```

---

## Task 9: Update Rankings API — Add `lens` Parameter

**Files:**
- Modify: `src/app/api/rankings/route.ts`

**Step 1: Rewrite the rankings route to support lens parameter**

Replace the entire file `src/app/api/rankings/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { checkPaywall, paywallErrorResponse } from "@/lib/middleware/api-paywall";

export const dynamic = "force-dynamic";

const LENS_SORT_MAP: Record<string, { scoreCol: string; rankCol: string }> = {
  capability: { scoreCol: "capability_score", rankCol: "capability_rank" },
  usage:      { scoreCol: "usage_score",      rankCol: "usage_rank" },
  expert:     { scoreCol: "expert_score",     rankCol: "expert_rank" },
  balanced:   { scoreCol: "quality_score",    rankCol: "balanced_rank" },
};

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(`rankings:${ip}`, RATE_LIMITS.public);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const pw = await checkPaywall(request);
  if (!pw.allowed) return paywallErrorResponse(pw);

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { searchParams } = new URL(request.url);
  const lens = searchParams.get("lens") || "capability";
  const category = searchParams.get("category");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

  // Validate lens
  const lensConfig = LENS_SORT_MAP[lens];
  if (!lensConfig) {
    return NextResponse.json(
      { error: `Invalid lens. Must be one of: ${Object.keys(LENS_SORT_MAP).join(", ")}` },
      { status: 400 }
    );
  }

  // Query models directly sorted by the lens rank column
  let query = supabase
    .from("models")
    .select(`
      id, slug, name, provider, category, parameter_count, is_open_weights,
      hf_downloads, quality_score, capability_score, capability_rank,
      usage_score, usage_rank, expert_score, expert_rank, balanced_rank,
      popularity_score, popularity_rank, market_cap_estimate, agent_score, agent_rank,
      value_score,
      benchmark_scores(score_normalized, benchmarks(slug, name)),
      model_pricing(input_price_per_million, output_price_per_million, provider_name, median_output_tokens_per_second),
      elo_ratings(elo_score, arena_name)
    `)
    .eq("status", "active")
    .not(lensConfig.rankCol, "is", null)
    .order(lensConfig.rankCol, { ascending: true })
    .limit(limit);

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, lens });
}
```

**Step 2: Commit**

```bash
git add src/app/api/rankings/route.ts
git commit -m "feat: add lens parameter to rankings API (capability/usage/expert/balanced)"
```

---

## Task 10: Update Models API — Add Lens Sorting

**Files:**
- Modify: `src/app/api/models/route.ts:46-52` (sortMap)

**Step 1: Update the sort map to support lens-based sorting**

In `src/app/api/models/route.ts`, replace the sortMap (lines 46-52):

```typescript
  const sortMap: Record<string, { column: string; ascending: boolean }> = {
    rank: { column: "balanced_rank", ascending: true },
    capability: { column: "capability_rank", ascending: true },
    usage: { column: "usage_rank", ascending: true },
    expert: { column: "expert_rank", ascending: true },
    popular: { column: "popularity_score", ascending: false },
    newest: { column: "release_date", ascending: false },
    downloads: { column: "hf_downloads", ascending: false },
    quality: { column: "quality_score", ascending: false },
  };
```

**Step 2: Commit**

```bash
git add src/app/api/models/route.ts
git commit -m "feat: add lens-based sorting to models API"
```

---

## Task 11: Update Leaderboard UI — Add Lens Toggle

**Files:**
- Modify: `src/components/models/leaderboard-explorer.tsx:16-32` (interface + state)
- Modify: `src/components/models/leaderboard-explorer.tsx` (add lens toggle UI before category tabs)

**Step 1: Update the LeaderboardModel interface**

In `src/components/models/leaderboard-explorer.tsx`, replace the interface (lines 16-32):

```typescript
interface LeaderboardModel {
  name: string;
  slug: string;
  provider: string;
  category: string;
  overall_rank: number | null;
  category_rank: number | null;
  quality_score: number | null;
  value_score: number | null;
  is_open_weights: boolean;
  hf_downloads: number | null;
  popularity_score: number | null;
  agent_score: number | null;
  agent_rank: number | null;
  popularity_rank: number | null;
  market_cap_estimate: number | null;
  // New lens fields
  capability_score: number | null;
  capability_rank: number | null;
  usage_score: number | null;
  usage_rank: number | null;
  expert_score: number | null;
  expert_rank: number | null;
  balanced_rank: number | null;
}

type RankingLens = "capability" | "usage" | "expert" | "balanced";

const LENS_TABS = [
  { value: "capability" as const, label: "Capability", description: "Pure benchmark performance" },
  { value: "usage" as const, label: "Usage", description: "What people actually use" },
  { value: "expert" as const, label: "Expert", description: "Research consensus" },
  { value: "balanced" as const, label: "Balanced", description: "Composite of all signals" },
];

function getLensRank(model: LeaderboardModel, lens: RankingLens): number | null {
  switch (lens) {
    case "capability": return model.capability_rank;
    case "usage": return model.usage_rank;
    case "expert": return model.expert_rank;
    case "balanced": return model.balanced_rank;
  }
}

function getLensScore(model: LeaderboardModel, lens: RankingLens): number | null {
  switch (lens) {
    case "capability": return model.capability_score;
    case "usage": return model.usage_score;
    case "expert": return model.expert_score;
    case "balanced": return model.quality_score;
  }
}
```

**Step 2: Add lens state and toggle UI**

Inside the component function, after the existing state declarations, add:

```typescript
const [activeLens, setActiveLens] = useState<RankingLens>("capability");
```

Add the lens toggle UI before the category tabs. This should be a row of pill buttons:

```tsx
{/* Lens Toggle */}
<div className="flex gap-2 mb-4">
  {LENS_TABS.map((lens) => (
    <button
      key={lens.value}
      onClick={() => setActiveLens(lens.value)}
      className={cn(
        "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
        activeLens === lens.value
          ? "bg-white text-black"
          : "bg-white/10 text-white/60 hover:bg-white/20"
      )}
      title={lens.description}
    >
      {lens.label}
    </button>
  ))}
</div>
```

**Step 3: Update the table's rank and score columns**

In the column definitions, update the rank column to use the active lens:

```typescript
// Replace the rank column accessor
{
  accessorFn: (row) => getLensRank(row, activeLens),
  id: "rank",
  header: "Rank",
  // ... existing cell renderer
}

// Replace the score column accessor
{
  accessorFn: (row) => getLensScore(row, activeLens),
  id: "score",
  header: `${LENS_TABS.find(l => l.value === activeLens)?.label ?? "Score"}`,
  // ... existing cell renderer with ScoreBar
}
```

**Step 4: Update the default sort to use active lens rank**

When the lens changes, the data should re-sort. The existing `useMemo` for filtered/sorted models should incorporate `activeLens` as a dependency and sort by the lens rank.

**Step 5: Commit**

```bash
git add src/components/models/leaderboard-explorer.tsx
git commit -m "feat: add lens toggle UI to leaderboard explorer"
```

---

## Task 12: Update Ranking Weight Controls for Lens Awareness

**Files:**
- Modify: `src/components/models/ranking-weight-controls.tsx:17-33` (interface)

**Step 1: Add new lens score fields to the RankableModel interface**

In `src/components/models/ranking-weight-controls.tsx`, add to the `RankableModel` interface (after line 32):

```typescript
  capability_score: number | null;
  capability_rank: number | null;
  usage_score: number | null;
  usage_rank: number | null;
  expert_score: number | null;
  expert_rank: number | null;
  balanced_rank: number | null;
```

**Step 2: Commit**

```bash
git add src/components/models/ranking-weight-controls.tsx
git commit -m "feat: update ranking weight controls interface for lens scores"
```

---

## Task 13: Wire Pipeline Health into Orchestrator

**Files:**
- Modify: `src/lib/data-sources/orchestrator.ts:168-175` (after adapter execution)

**Step 1: Add health tracking to executeAdapter**

In `src/lib/data-sources/orchestrator.ts`, add import at top:

```typescript
import { recordSyncSuccess, recordSyncFailure } from "@/lib/pipeline-health";
```

After line 166 (where `data_sources` record is updated), add:

```typescript
  // Track pipeline health
  if (status === "failed") {
    await recordSyncFailure(source.slug).catch(() => {});
  } else {
    await recordSyncSuccess(source.slug).catch(() => {});
  }
```

**Step 2: Commit**

```bash
git add src/lib/data-sources/orchestrator.ts
git commit -m "feat: wire pipeline health tracking into sync orchestrator"
```

---

## Task 14: Update Sync Cron for Tiered Schedules

**Files:**
- Create: `supabase/migrations/015_tiered_sync_pg_cron.sql`

**Step 1: Create the pg_cron migration**

Create `supabase/migrations/015_tiered_sync_pg_cron.sql`:

```sql
-- Tiered sync schedules via pg_cron
-- T0 (2h): provider model catalogs
-- T1 (6h): HF stats, benchmarks, ELO
-- T2 (24h): GitHub, news, pricing
-- T3 (weekly): leaderboard crawls

-- Update data_sources tier assignments
UPDATE data_sources SET tier = 0, sync_interval_hours = 2
WHERE adapter_type IN ('openai-models', 'anthropic-models', 'google-models', 'openrouter-models');

UPDATE data_sources SET tier = 1, sync_interval_hours = 6
WHERE adapter_type IN ('huggingface', 'open-llm-leaderboard', 'chatbot-arena');

UPDATE data_sources SET tier = 2, sync_interval_hours = 24
WHERE adapter_type IN ('github-stars', 'provider-news', 'provider-pricing', 'x-announcements');

UPDATE data_sources SET tier = 3, sync_interval_hours = 168
WHERE adapter_type IN ('livebench', 'seal-leaderboard', 'bigcode-leaderboard', 'open-vlm-leaderboard');

-- Update pipeline_health expected intervals
UPDATE pipeline_health SET expected_interval_hours = ds.sync_interval_hours
FROM data_sources ds WHERE pipeline_health.source_slug = ds.slug;

-- NOTE: pg_cron schedules should be configured in Supabase dashboard or via:
-- SELECT cron.schedule('sync-t0', '0 */2 * * *', $$SELECT net.http_get(...)$$);
-- SELECT cron.schedule('sync-t1', '0 */6 * * *', $$SELECT net.http_get(...)$$);
-- SELECT cron.schedule('sync-t2', '0 4 * * *',   $$SELECT net.http_get(...)$$);
-- SELECT cron.schedule('sync-t3', '0 2 * * 0',   $$SELECT net.http_get(...)$$);
-- Actual URLs depend on deployment environment — configure in Supabase dashboard.
```

**Step 2: Commit**

```bash
git add supabase/migrations/015_tiered_sync_pg_cron.sql
git commit -m "feat: tiered sync schedule migration for data sources"
```

---

## Task 15: Data Validation Layer

**Files:**
- Create: `src/lib/data-sources/validation.ts`

**Step 1: Create the validation module**

Create `src/lib/data-sources/validation.ts`:

```typescript
/**
 * Data validation for adapter outputs.
 * Prevents bad data from corrupting scores.
 */

/** Validate a benchmark score is in expected range */
export function isValidBenchmarkScore(score: number, benchmarkSlug: string): boolean {
  if (benchmarkSlug.includes("elo") || benchmarkSlug.includes("arena")) {
    return score >= 500 && score <= 2500;
  }
  return score >= 0 && score <= 100;
}

/** Check if a score changed too much from previous (possible bad data) */
export function isAnomalousChange(
  newScore: number,
  previousScore: number | null,
  maxChangePercent: number = 30
): boolean {
  if (previousScore == null || previousScore === 0) return false;
  const change = Math.abs(newScore - previousScore) / previousScore * 100;
  return change > maxChangePercent;
}

/** Validate model pricing is reasonable */
export function isValidPricing(inputPrice: number, outputPrice: number): boolean {
  // Prices should be 0 (free) or between $0.001 and $500 per million tokens
  if (inputPrice === 0 && outputPrice === 0) return true;
  if (inputPrice < 0 || outputPrice < 0) return false;
  if (inputPrice > 500 || outputPrice > 500) return false;
  return true;
}

/** Validate download counts (should be positive, not absurdly large) */
export function isValidDownloadCount(downloads: number): boolean {
  return downloads >= 0 && downloads < 100_000_000_000; // 100B max
}
```

**Step 2: Commit**

```bash
git add src/lib/data-sources/validation.ts
git commit -m "feat: add data validation layer for adapter outputs"
```

---

## Task 16: Final Integration — Update Quality Calculator Coverage Penalty

**Files:**
- Modify: `src/lib/scoring/quality-calculator.ts:285-312` (coverage penalty section)

**Step 1: Fix the coverage penalty**

In `src/lib/scoring/quality-calculator.ts`, replace the coverage penalty logic (lines 294-312):

```typescript
  // Coverage penalty: discrete steps based on EVIDENCE signal count.
  // "openness" and "recency" are attributes, not evidence — don't count them.
  const evidenceSignals = signals.filter(s => s.name !== "openness" && s.name !== "recency");
  const evidenceCount = evidenceSignals.length;

  let coveragePenalty: number;
  if (evidenceCount === 0) return 0;
  else if (evidenceCount === 1) coveragePenalty = 0.40;
  else if (evidenceCount === 2) coveragePenalty = 0.65;
  else if (evidenceCount === 3) coveragePenalty = 0.85;
  else coveragePenalty = 1.00;

  let penalizedScore = weightedSum * coveragePenalty;
```

This replaces the old sqrt-based coverage penalty that counted all signals including openness.

**Step 2: Commit**

```bash
git add src/lib/scoring/quality-calculator.ts
git commit -m "fix: coverage penalty excludes static attributes, uses discrete steps"
```

---

## Task 17: Verify Build

**Step 1: Run TypeScript compiler**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Run the dev server briefly to check for import errors**

Run: `npx next build` (or `npm run build`)
Expected: Build succeeds

**Step 3: Fix any type errors that arise from the new columns**

The Database type in `src/types/database.ts` will need to match what Supabase expects. If there are type errors in the cron route or API routes from accessing new columns that don't exist in the Database generic yet, update the Database type's Tables.models.Row to include the new fields.

**Step 4: Commit any fixes**

```bash
git add -u
git commit -m "fix: resolve type errors from multi-lens scoring integration"
```

---

## Summary of Files Created/Modified

| # | File | Action |
|---|------|--------|
| 1 | `supabase/migrations/014_multi_lens_scoring.sql` | Create |
| 2 | `src/types/database.ts` | Modify (add lens columns to interfaces) |
| 3 | `src/lib/scoring/capability-calculator.ts` | Create |
| 4 | `src/lib/scoring/usage-calculator.ts` | Create |
| 5 | `src/lib/scoring/expert-calculator.ts` | Create |
| 6 | `src/lib/scoring/market-cap-calculator.ts` | Modify (fix formula) |
| 7 | `src/lib/scoring/balanced-calculator.ts` | Create |
| 8 | `src/lib/scoring/quality-calculator.ts` | Modify (fix coverage penalty) |
| 9 | `src/lib/pipeline-health.ts` | Create |
| 10 | `src/lib/data-sources/validation.ts` | Create |
| 11 | `src/lib/data-sources/orchestrator.ts` | Modify (add health tracking) |
| 12 | `src/app/api/cron/compute-scores/route.ts` | Modify (compute all 4 lenses) |
| 13 | `src/app/api/rankings/route.ts` | Rewrite (add lens parameter) |
| 14 | `src/app/api/models/route.ts` | Modify (add lens sorting) |
| 15 | `src/components/models/leaderboard-explorer.tsx` | Modify (add lens toggle) |
| 16 | `src/components/models/ranking-weight-controls.tsx` | Modify (update interface) |
| 17 | `supabase/migrations/015_tiered_sync_pg_cron.sql` | Create |

**Total: 7 new files, 10 modified files, 17 tasks, ~17 commits**
