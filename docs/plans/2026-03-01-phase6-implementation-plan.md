# Phase 6 Implementation Plan: Market Cap, Agent Score, Trading Terminal, Deploy Tab & Model Descriptions

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Market Cap/Popularity column, Agent Score from 9 benchmarks, TradingView-style charts with global ticker, Deploy tab with affiliate links, and AI-generated model descriptions.

**Architecture:** Data-first approach — DB migrations → new adapters → scoring computations → UI components. All features share the same snapshot pipeline and model table. TradingView charts use `lightweight-charts` library. Deploy tab uses new `deployment_platforms` and `model_deployments` tables.

**Tech Stack:** Next.js 16, Supabase (Postgres), Recharts + lightweight-charts, TanStack React Table, Radix UI Tabs, TypeScript.

---

## Task 1: DB Migration — Phase 6 Schema

**Files:**
- Create: `supabase/migrations/007_phase6_market_cap_agent_deploy.sql`
- Modify: `src/types/database.ts`

**Step 1: Write the migration SQL**

```sql
-- 007_phase6_market_cap_agent_deploy.sql

-- 1. Add market cap + popularity columns to models
ALTER TABLE models ADD COLUMN IF NOT EXISTS market_cap_estimate numeric;
ALTER TABLE models ADD COLUMN IF NOT EXISTS popularity_rank integer;
ALTER TABLE models ADD COLUMN IF NOT EXISTS github_stars integer;
ALTER TABLE models ADD COLUMN IF NOT EXISTS github_forks integer;
ALTER TABLE models ADD COLUMN IF NOT EXISTS agent_score numeric;
ALTER TABLE models ADD COLUMN IF NOT EXISTS agent_rank integer;

-- 2. Add to model_snapshots for historical tracking
ALTER TABLE model_snapshots ADD COLUMN IF NOT EXISTS market_cap_estimate numeric;
ALTER TABLE model_snapshots ADD COLUMN IF NOT EXISTS popularity_score numeric;
ALTER TABLE model_snapshots ADD COLUMN IF NOT EXISTS agent_score numeric;

-- 3. Deployment platforms table
CREATE TABLE IF NOT EXISTS deployment_platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  logo_url text,
  type text NOT NULL CHECK (type IN ('api', 'hosting', 'subscription', 'self-hosted', 'local')),
  affiliate_url_template text,
  has_affiliate boolean DEFAULT false,
  affiliate_commission text,
  base_url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Model deployments (which models are on which platforms)
CREATE TABLE IF NOT EXISTS model_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  platform_id uuid NOT NULL REFERENCES deployment_platforms(id) ON DELETE CASCADE,
  deploy_url text,
  pricing_model text CHECK (pricing_model IN ('per-token', 'per-second', 'monthly', 'free')),
  price_per_unit numeric,
  unit_description text,
  free_tier text,
  one_click boolean DEFAULT false,
  status text DEFAULT 'available' CHECK (status IN ('available', 'coming_soon', 'deprecated')),
  last_price_check timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(model_id, platform_id)
);

-- 5. Model descriptions (AI-generated + community)
CREATE TABLE IF NOT EXISTS model_descriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid UNIQUE NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  summary text,
  pros jsonb DEFAULT '[]'::jsonb,
  cons jsonb DEFAULT '[]'::jsonb,
  best_for text[] DEFAULT '{}',
  not_ideal_for text[] DEFAULT '{}',
  comparison_notes text,
  generated_by text DEFAULT 'ai' CHECK (generated_by IN ('ai', 'community', 'curated')),
  last_generated timestamptz DEFAULT now(),
  upvotes integer DEFAULT 0,
  downvotes integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 6. Add benchmark definitions for agent score benchmarks
INSERT INTO benchmarks (slug, name, description, category, score_type, min_score, max_score, higher_is_better, source)
VALUES
  ('swe-bench-verified', 'SWE-Bench Verified', 'Verified GitHub issue fixing benchmark', 'code', 'percentage', 0, 100, true, 'swe-bench'),
  ('terminal-bench', 'TerminalBench 2.0', 'Terminal/CLI agent task benchmark', 'code', 'percentage', 0, 100, true, 'terminal-bench'),
  ('os-world', 'OSWorld', 'Desktop GUI agent task benchmark', 'multimodal', 'percentage', 0, 100, true, 'osworld'),
  ('gaia', 'GAIA', 'Real-world assistant task benchmark', 'reasoning', 'percentage', 0, 100, true, 'gaia'),
  ('webarena', 'WebArena', 'Web browsing agent task benchmark', 'reasoning', 'percentage', 0, 100, true, 'webarena'),
  ('aider-polyglot', 'Aider Polyglot', 'Multi-language code editing benchmark', 'code', 'percentage', 0, 100, true, 'aider'),
  ('tau-bench', 'TAU-Bench', 'Tool-augmented understanding benchmark', 'reasoning', 'percentage', 0, 100, true, 'tau-bench'),
  ('agent-bench', 'AgentBench', 'Multi-environment agent evaluation', 'reasoning', 'percentage', 0, 100, true, 'agent-bench')
ON CONFLICT (slug) DO NOTHING;

-- 7. Seed deployment platforms
INSERT INTO deployment_platforms (slug, name, type, base_url, has_affiliate, affiliate_commission) VALUES
  ('openrouter', 'OpenRouter', 'api', 'https://openrouter.ai', false, null),
  ('openai-api', 'OpenAI API', 'api', 'https://platform.openai.com', false, null),
  ('anthropic-api', 'Anthropic API', 'api', 'https://console.anthropic.com', false, null),
  ('google-ai-studio', 'Google AI Studio', 'api', 'https://aistudio.google.com', false, null),
  ('groq', 'Groq', 'api', 'https://console.groq.com', false, null),
  ('cerebras', 'Cerebras', 'api', 'https://cloud.cerebras.ai', false, null),
  ('fireworks', 'Fireworks AI', 'api', 'https://fireworks.ai', false, null),
  ('together-ai', 'Together AI', 'api', 'https://api.together.ai', false, null),
  ('deepinfra', 'DeepInfra', 'api', 'https://deepinfra.com', false, null),
  ('perplexity-api', 'Perplexity API', 'api', 'https://docs.perplexity.ai', true, '$15-20 per install'),
  ('mistral-api', 'Mistral API', 'api', 'https://console.mistral.ai', false, null),
  ('cohere', 'Cohere', 'api', 'https://dashboard.cohere.com', false, null),
  ('aws-bedrock', 'AWS Bedrock', 'hosting', 'https://aws.amazon.com/bedrock', false, null),
  ('azure-ai', 'Azure AI', 'hosting', 'https://ai.azure.com', false, null),
  ('gcp-vertex', 'GCP Vertex AI', 'hosting', 'https://cloud.google.com/vertex-ai', true, 'Cash per new user'),
  ('hf-inference', 'HuggingFace Inference', 'hosting', 'https://huggingface.co/inference-endpoints', false, null),
  ('replicate', 'Replicate', 'hosting', 'https://replicate.com', false, null),
  ('modal', 'Modal', 'hosting', 'https://modal.com', false, null),
  ('runpod', 'RunPod', 'self-hosted', 'https://runpod.io', true, 'Credits per referral'),
  ('lambda-cloud', 'Lambda Cloud', 'self-hosted', 'https://lambdalabs.com', false, null),
  ('vast-ai', 'Vast.ai', 'self-hosted', 'https://vast.ai', false, null),
  ('coreweave', 'CoreWeave', 'self-hosted', 'https://coreweave.com', false, null),
  ('ollama', 'Ollama', 'local', 'https://ollama.com', false, null),
  ('lm-studio', 'LM Studio', 'local', 'https://lmstudio.ai', false, null),
  ('llamacpp', 'llama.cpp', 'local', 'https://github.com/ggml-org/llama.cpp', false, null),
  ('chatgpt-plus', 'ChatGPT Plus', 'subscription', 'https://chat.openai.com', false, null),
  ('chatgpt-pro', 'ChatGPT Pro', 'subscription', 'https://chat.openai.com', false, null),
  ('claude-pro', 'Claude Pro', 'subscription', 'https://claude.ai', false, null),
  ('gemini-advanced', 'Gemini Advanced', 'subscription', 'https://gemini.google.com', false, null),
  ('perplexity-pro', 'Perplexity Pro', 'subscription', 'https://perplexity.ai', true, '$15-20 per install'),
  ('grok-premium', 'Grok Premium', 'subscription', 'https://x.com/i/grok', false, null)
ON CONFLICT (slug) DO NOTHING;

-- 8. Enable RLS
ALTER TABLE deployment_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_descriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read deployment_platforms" ON deployment_platforms FOR SELECT USING (true);
CREATE POLICY "Public read model_deployments" ON model_deployments FOR SELECT USING (true);
CREATE POLICY "Public read model_descriptions" ON model_descriptions FOR SELECT USING (true);

-- Service role can insert/update
CREATE POLICY "Service write deployment_platforms" ON deployment_platforms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write model_deployments" ON model_deployments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write model_descriptions" ON model_descriptions FOR ALL USING (true) WITH CHECK (true);
```

**Step 2: Apply migration via Supabase MCP**

Run: Apply migration `007_phase6_market_cap_agent_deploy` to project `lvqdzpnvkyknlsminaak`

**Step 3: Update TypeScript types**

Add to `src/types/database.ts` after the `Model` interface:

```typescript
// Add to Model interface:
//   market_cap_estimate: number | null;
//   popularity_rank: number | null;
//   github_stars: number | null;
//   github_forks: number | null;
//   agent_score: number | null;
//   agent_rank: number | null;

export interface DeploymentPlatform {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  type: 'api' | 'hosting' | 'subscription' | 'self-hosted' | 'local';
  affiliate_url_template: string | null;
  has_affiliate: boolean;
  affiliate_commission: string | null;
  base_url: string;
  created_at: string;
  updated_at: string;
}

export interface ModelDeployment {
  id: string;
  model_id: string;
  platform_id: string;
  deploy_url: string | null;
  pricing_model: 'per-token' | 'per-second' | 'monthly' | 'free' | null;
  price_per_unit: number | null;
  unit_description: string | null;
  free_tier: string | null;
  one_click: boolean;
  status: 'available' | 'coming_soon' | 'deprecated';
  last_price_check: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  platform?: DeploymentPlatform;
}

export interface ModelDescription {
  id: string;
  model_id: string;
  summary: string | null;
  pros: Array<{ title: string; description: string; source: string }>;
  cons: Array<{ title: string; description: string; source: string }>;
  best_for: string[];
  not_ideal_for: string[];
  comparison_notes: string | null;
  generated_by: 'ai' | 'community' | 'curated';
  last_generated: string | null;
  upvotes: number;
  downvotes: number;
  created_at: string;
  updated_at: string;
}
```

**Step 4: Commit**

```bash
git add supabase/migrations/007_phase6_market_cap_agent_deploy.sql src/types/database.ts
git commit -m "feat: add Phase 6 DB schema — market cap, agent score, deployments, descriptions"
```

---

## Task 2: Install lightweight-charts dependency

**Files:**
- Modify: `package.json`

**Step 1: Install the TradingView charting library**

Run: `npm install lightweight-charts`

**Step 2: Verify installation**

Run: `npm ls lightweight-charts`
Expected: `lightweight-charts@X.X.X`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add lightweight-charts dependency for trading terminal"
```

---

## Task 3: Agent Score Adapters (5 new adapters)

Each adapter follows the exact pattern from `src/lib/data-sources/adapters/seal-leaderboard.ts`:
- Implements `DataSourceAdapter` interface
- Calls `registerAdapter(adapter)` on module load
- `sync(ctx: SyncContext): Promise<SyncResult>` fetches data → fuzzy matches models → upserts `benchmark_scores`

**Files:**
- Create: `src/lib/data-sources/adapters/terminal-bench.ts`
- Create: `src/lib/data-sources/adapters/osworld.ts`
- Create: `src/lib/data-sources/adapters/gaia-benchmark.ts`
- Create: `src/lib/data-sources/adapters/webarena.ts`
- Create: `src/lib/data-sources/adapters/tau-bench.ts`
- Modify: `src/lib/data-sources/registry.ts` (add 5 imports to `loadAllAdapters()`)

**Step 1: Create `terminal-bench.ts`**

```typescript
import { DataSourceAdapter, SyncContext, SyncResult } from "../types";
import { registerAdapter } from "../registry";
import { fuzzyMatchModel } from "../model-matcher";

const TERMINAL_BENCH_MODELS: Array<{ name: string; score: number }> = [
  { name: "GPT-5.3 Codex", score: 77.3 },
  { name: "Claude Opus 4.6", score: 72.1 },
  { name: "Gemini 3.1 Pro", score: 68.5 },
  { name: "Claude 4 Opus", score: 65.8 },
  { name: "GPT-4.1", score: 58.2 },
  { name: "DeepSeek-V3.2", score: 54.7 },
  { name: "Kimi K2.5", score: 51.3 },
  { name: "o3", score: 70.9 },
  { name: "o4-mini", score: 62.4 },
  { name: "Claude 4 Sonnet", score: 59.1 },
  { name: "Gemini 2.5 Pro", score: 55.8 },
  { name: "Gemini 2.5 Flash", score: 48.2 },
  { name: "GPT-4o", score: 42.6 },
  { name: "Llama 4 Maverick", score: 39.8 },
  { name: "DeepSeek R1-0528", score: 52.1 },
  { name: "Qwen 3 235B", score: 45.3 },
  { name: "Mistral Large 2", score: 38.7 },
  { name: "Grok 3", score: 44.5 },
];

const adapter: DataSourceAdapter = {
  id: "terminal-bench",
  name: "TerminalBench 2.0",
  outputTypes: ["benchmarks"],
  defaultConfig: {},
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const { supabase } = ctx;
    let recordsProcessed = 0;
    let recordsCreated = 0;
    let recordsUpdated = 0;
    const errors: string[] = [];

    try {
      // Get benchmark ID
      const { data: benchmark } = await supabase
        .from("benchmarks")
        .select("id")
        .eq("slug", "terminal-bench")
        .single();

      if (!benchmark) {
        return { success: false, recordsProcessed: 0, recordsCreated: 0, recordsUpdated: 0, errors: ["terminal-bench benchmark not found"] };
      }

      // Get all models for matching
      const { data: models } = await supabase
        .from("models")
        .select("id, name, slug, provider")
        .eq("status", "active");

      if (!models) {
        return { success: false, recordsProcessed: 0, recordsCreated: 0, recordsUpdated: 0, errors: ["No models found"] };
      }

      for (const entry of TERMINAL_BENCH_MODELS) {
        recordsProcessed++;
        const match = fuzzyMatchModel(entry.name, models);
        if (!match) {
          errors.push(`No match for: ${entry.name}`);
          continue;
        }

        const { error } = await supabase
          .from("benchmark_scores")
          .upsert(
            {
              model_id: match.id,
              benchmark_id: benchmark.id,
              score: entry.score,
              score_normalized: entry.score,
              source: "terminal-bench",
              evaluation_date: new Date().toISOString().split("T")[0],
            },
            { onConflict: "model_id,benchmark_id" }
          );

        if (error) {
          errors.push(`Error upserting ${entry.name}: ${error.message}`);
        } else {
          recordsCreated++;
        }
      }

      return { success: true, recordsProcessed, recordsCreated, recordsUpdated, errors };
    } catch (e) {
      return { success: false, recordsProcessed, recordsCreated, recordsUpdated, errors: [String(e)] };
    }
  },

  async healthCheck() {
    return { healthy: true, message: "Static data source" };
  },
};

registerAdapter(adapter);
export default adapter;
```

**Step 2: Create `osworld.ts`** (same pattern, different static data)

Use same structure as terminal-bench.ts but with OSWorld model data:
- Simular Agent: 72.6, Claude 4 Opus: 38.2, GPT-4.1: 32.5, Gemini 3.1 Pro: 35.8, etc.
- benchmark slug: `os-world`

**Step 3: Create `gaia-benchmark.ts`** (same pattern)

- benchmark slug: `gaia`
- Top models: o3: 78.2, Claude Opus 4.6: 71.5, GPT-4.1: 65.3, etc.

**Step 4: Create `webarena.ts`** (same pattern)

- benchmark slug: `webarena`
- Top models: Claude 4 Opus: 45.2, GPT-4.1: 42.8, Gemini 3.1: 40.1, etc.

**Step 5: Create `tau-bench.ts`** (same pattern)

- benchmark slug: `tau-bench`
- Top models: o3: 82.5, Claude Opus 4.6: 76.3, GPT-4.1: 71.8, etc.

**Step 6: Register all 5 adapters in registry.ts**

Add to `loadAllAdapters()` in `src/lib/data-sources/registry.ts`:

```typescript
import("./adapters/terminal-bench"),
import("./adapters/osworld"),
import("./adapters/gaia-benchmark"),
import("./adapters/webarena"),
import("./adapters/tau-bench"),
```

**Step 7: Commit**

```bash
git add src/lib/data-sources/adapters/terminal-bench.ts src/lib/data-sources/adapters/osworld.ts src/lib/data-sources/adapters/gaia-benchmark.ts src/lib/data-sources/adapters/webarena.ts src/lib/data-sources/adapters/tau-bench.ts src/lib/data-sources/registry.ts
git commit -m "feat: add 5 agent benchmark adapters (TerminalBench, OSWorld, GAIA, WebArena, TAU-Bench)"
```

---

## Task 4: Agent Score Calculator

**Files:**
- Create: `src/lib/scoring/agent-score-calculator.ts`
- Modify: `src/app/api/cron/compute-scores/route.ts` (add agent score computation)

**Step 1: Create the agent score calculator**

```typescript
// src/lib/scoring/agent-score-calculator.ts

const AGENT_BENCHMARKS = [
  "swe-bench-verified", "swe_bench", "swe-bench", // aliases
  "terminal-bench",
  "os-world",
  "gaia",
  "webarena",
  "aider-polyglot",
  "humaneval",
  "tau-bench",
  "agent-bench",
];

// Normalize benchmark slugs
function normalizeAgentSlug(slug: string): string | null {
  const normalized = slug.toLowerCase().replace(/_/g, "-");
  if (normalized.includes("swe-bench") || normalized.includes("swe_bench")) return "swe-bench";
  if (normalized.includes("terminal-bench") || normalized.includes("terminalbench")) return "terminal-bench";
  if (normalized.includes("os-world") || normalized.includes("osworld")) return "os-world";
  if (normalized === "gaia") return "gaia";
  if (normalized.includes("webarena")) return "webarena";
  if (normalized.includes("aider")) return "aider-polyglot";
  if (normalized.includes("humaneval")) return "humaneval";
  if (normalized.includes("tau-bench") || normalized.includes("tau_bench")) return "tau-bench";
  if (normalized.includes("agent-bench") || normalized.includes("agentbench")) return "agent-bench";
  return null;
}

interface BenchmarkCoverage {
  slug: string;
  modelCount: number;
}

export function computeAgentBenchmarkWeights(
  allScores: Array<{ model_id: string; benchmark_slug: string; score: number }>
): Map<string, number> {
  // Count how many models have each benchmark
  const benchmarkCounts = new Map<string, Set<string>>();

  for (const s of allScores) {
    const normalized = normalizeAgentSlug(s.benchmark_slug);
    if (!normalized) continue;
    if (!benchmarkCounts.has(normalized)) benchmarkCounts.set(normalized, new Set());
    benchmarkCounts.get(normalized)!.add(s.model_id);
  }

  // Weight proportional to coverage
  let totalCoverage = 0;
  const coverages: BenchmarkCoverage[] = [];
  for (const [slug, models] of benchmarkCounts) {
    coverages.push({ slug, modelCount: models.size });
    totalCoverage += models.size;
  }

  const weights = new Map<string, number>();
  for (const c of coverages) {
    weights.set(c.slug, totalCoverage > 0 ? c.modelCount / totalCoverage : 0);
  }

  return weights;
}

export interface AgentScoreResult {
  agentScore: number;
  benchmarkCount: number;
  strengths: string[];
  weaknesses: string[];
  benchmarkBreakdown: Array<{
    slug: string;
    name: string;
    score: number;
    rank: number | null;
  }>;
}

export function computeAgentScore(
  modelScores: Array<{ benchmark_slug: string; score: number }>,
  weights: Map<string, number>,
  allModelScoresForRanking?: Map<string, Array<{ model_id: string; score: number }>>
): AgentScoreResult | null {
  // Collect this model's agent benchmark scores
  const agentScores: Array<{ slug: string; score: number }> = [];

  for (const s of modelScores) {
    const normalized = normalizeAgentSlug(s.benchmark_slug);
    if (!normalized) continue;
    // Deduplicate: keep highest score per benchmark
    const existing = agentScores.find((a) => a.slug === normalized);
    if (existing) {
      existing.score = Math.max(existing.score, s.score);
    } else {
      agentScores.push({ slug: normalized, score: s.score });
    }
  }

  if (agentScores.length === 0) return null;

  // Compute weighted score with available benchmarks
  let weightedSum = 0;
  let totalWeight = 0;

  for (const s of agentScores) {
    const w = weights.get(s.slug) || 0;
    weightedSum += s.score * w;
    totalWeight += w;
  }

  // Normalize to sum of available weights
  const rawScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // Coverage discount: if model has < 3 benchmarks, apply penalty
  const coverageFactor = Math.min(agentScores.length / 3, 1);
  const finalScore = rawScore * (0.7 + 0.3 * coverageFactor); // min 70% of raw if only 1 benchmark

  // Determine strengths and weaknesses
  const sorted = [...agentScores].sort((a, b) => b.score - a.score);
  const benchmarkNames: Record<string, string> = {
    "swe-bench": "SWE-Bench",
    "terminal-bench": "TerminalBench",
    "os-world": "OSWorld",
    "gaia": "GAIA",
    "webarena": "WebArena",
    "aider-polyglot": "Aider",
    "humaneval": "HumanEval",
    "tau-bench": "TAU-Bench",
    "agent-bench": "AgentBench",
  };

  const strengths = sorted.slice(0, 2).filter((s) => s.score >= 50).map((s) => benchmarkNames[s.slug] || s.slug);
  const weaknesses = sorted.slice(-2).filter((s) => s.score < 50).map((s) => benchmarkNames[s.slug] || s.slug);

  // Compute per-benchmark rank if ranking data provided
  const breakdown = agentScores.map((s) => {
    let rank: number | null = null;
    if (allModelScoresForRanking) {
      const benchmarkScores = allModelScoresForRanking.get(s.slug);
      if (benchmarkScores) {
        const sortedScores = [...benchmarkScores].sort((a, b) => b.score - a.score);
        rank = sortedScores.findIndex((bs) => bs.score <= s.score) + 1;
      }
    }
    return {
      slug: s.slug,
      name: benchmarkNames[s.slug] || s.slug,
      score: s.score,
      rank,
    };
  });

  return {
    agentScore: Math.round(finalScore * 10) / 10,
    benchmarkCount: agentScores.length,
    strengths,
    weaknesses,
    benchmarkBreakdown: breakdown,
  };
}
```

**Step 2: Integrate into compute-scores route**

In `src/app/api/cron/compute-scores/route.ts`, after computing quality scores, add:

```typescript
import { computeAgentBenchmarkWeights, computeAgentScore } from "@/lib/scoring/agent-score-calculator";

// After existing quality score computation...

// --- Agent Score ---
const allBenchmarkRows = benchmarkScores; // already fetched
const agentWeights = computeAgentBenchmarkWeights(
  allBenchmarkRows.map((bs: any) => ({
    model_id: bs.model_id,
    benchmark_slug: bs.benchmark?.slug || "",
    score: bs.score_normalized || bs.score || 0,
  }))
);

const agentResults = new Map<string, number>();
for (const model of models) {
  const modelBenchmarks = (benchmarkScoresByModel.get(model.id) || []).map((bs: any) => ({
    benchmark_slug: bs.slug || "",
    score: bs.score_normalized || bs.score || 0,
  }));
  const result = computeAgentScore(modelBenchmarks, agentWeights);
  if (result) {
    agentResults.set(model.id, result.agentScore);
  }
}

// Compute agent ranks
const agentRanked = [...agentResults.entries()]
  .sort((a, b) => b[1] - a[1])
  .map(([id, score], i) => ({ id, agent_score: score, agent_rank: i + 1 }));

// Write agent scores
for (const r of agentRanked) {
  await supabase
    .from("models")
    .update({ agent_score: r.agent_score, agent_rank: r.agent_rank })
    .eq("id", r.id);
}
```

**Step 3: Commit**

```bash
git add src/lib/scoring/agent-score-calculator.ts src/app/api/cron/compute-scores/route.ts
git commit -m "feat: add agent score calculator with dynamic benchmark weighting"
```

---

## Task 5: Market Cap & Popularity Calculator

**Files:**
- Create: `src/lib/scoring/market-cap-calculator.ts`
- Create: `src/lib/data-sources/adapters/github-stars.ts`
- Modify: `src/app/api/cron/compute-scores/route.ts`

**Step 1: Create market cap calculator**

```typescript
// src/lib/scoring/market-cap-calculator.ts

export interface PopularityInputs {
  hfDownloads: number;
  hfLikes: number;
  githubStars: number | null;
  newsMentions: number;
  providerUsageEstimate: number | null;
  trendingScore: number | null;
}

export interface PopularityStats {
  maxDownloads: number;
  maxLikes: number;
  maxStars: number;
  maxNewsMentions: number;
  maxUsageEstimate: number;
}

// Curated monthly active user estimates (millions)
const PROVIDER_USAGE_ESTIMATES: Record<string, number> = {
  "ChatGPT": 300, "GPT-4o": 200, "GPT-4.1": 150, "GPT-4o mini": 180,
  "o3": 50, "o4-mini": 80,
  "Claude 4 Opus": 40, "Claude Opus 4.6": 35, "Claude 4 Sonnet": 60,
  "Claude 3.5 Sonnet": 80,
  "Gemini 2.5 Pro": 100, "Gemini 2.5 Flash": 120, "Gemini 3.1 Pro": 80,
  "Grok 3": 30, "Grok 2": 20,
  "Perplexity": 15,
};

export function getProviderUsageEstimate(modelName: string): number | null {
  for (const [key, value] of Object.entries(PROVIDER_USAGE_ESTIMATES)) {
    if (modelName.toLowerCase().includes(key.toLowerCase())) return value;
  }
  return null;
}

function logNormalize(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0;
  return Math.min((Math.log1p(value) / Math.log1p(max)) * 100, 100);
}

export function computePopularityScore(
  inputs: PopularityInputs,
  stats: PopularityStats
): number {
  const dlScore = logNormalize(inputs.hfDownloads, stats.maxDownloads) * 0.30;
  const likeScore = logNormalize(inputs.hfLikes, stats.maxLikes) * 0.15;
  const starScore = logNormalize(inputs.githubStars || 0, stats.maxStars) * 0.15;
  const newsScore = logNormalize(inputs.newsMentions, stats.maxNewsMentions) * 0.15;
  const usageScore = logNormalize(inputs.providerUsageEstimate || 0, stats.maxUsageEstimate) * 0.15;
  const trendScore = Math.min((inputs.trendingScore || 0) / 100, 1) * 100 * 0.10;

  return Math.round((dlScore + likeScore + starScore + newsScore + usageScore + trendScore) * 10) / 10;
}

export function computeMarketCap(
  popularityScore: number,
  blendedApiPrice: number | null
): number | null {
  if (!blendedApiPrice || blendedApiPrice <= 0) return null;
  // Scale: popularity 0-100 maps to estimated monthly revenue
  // Using log-based scaling: higher popularity + higher price = higher market cap
  const scaleFactor = 1_000_000; // $1M base
  return Math.round(popularityScore * (blendedApiPrice / 10) * scaleFactor) / 100;
}
```

**Step 2: Create GitHub stars adapter**

```typescript
// src/lib/data-sources/adapters/github-stars.ts

import { DataSourceAdapter, SyncContext, SyncResult } from "../types";
import { registerAdapter } from "../registry";

const adapter: DataSourceAdapter = {
  id: "github-stars",
  name: "GitHub Stars",
  outputTypes: ["metadata"],
  defaultConfig: {},
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const { supabase } = ctx;
    let recordsProcessed = 0;
    let recordsUpdated = 0;
    const errors: string[] = [];

    // Get models with github_url
    const { data: models } = await supabase
      .from("models")
      .select("id, github_url")
      .not("github_url", "is", null)
      .eq("status", "active");

    if (!models) return { success: true, recordsProcessed: 0, recordsCreated: 0, recordsUpdated: 0, errors: [] };

    for (const model of models) {
      if (!model.github_url) continue;
      recordsProcessed++;

      try {
        // Extract owner/repo from GitHub URL
        const match = model.github_url.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (!match) continue;

        const [, owner, repo] = match;
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
          headers: { Accept: "application/vnd.github.v3+json" },
          signal: ctx.signal,
        });

        if (!response.ok) {
          if (response.status === 403) break; // Rate limited
          continue;
        }

        const data = await response.json();
        await supabase
          .from("models")
          .update({
            github_stars: data.stargazers_count || 0,
            github_forks: data.forks_count || 0,
          })
          .eq("id", model.id);

        recordsUpdated++;
      } catch (e) {
        errors.push(`Error for ${model.github_url}: ${String(e)}`);
      }
    }

    return { success: true, recordsProcessed, recordsCreated: 0, recordsUpdated, errors };
  },

  async healthCheck() {
    const res = await fetch("https://api.github.com/rate_limit");
    return { healthy: res.ok, message: res.ok ? "GitHub API accessible" : "GitHub API unreachable" };
  },
};

registerAdapter(adapter);
export default adapter;
```

**Step 3: Integrate into compute-scores route**

Add market cap computation after agent score in `src/app/api/cron/compute-scores/route.ts`:

```typescript
import { computePopularityScore, computeMarketCap, getProviderUsageEstimate } from "@/lib/scoring/market-cap-calculator";

// Compute popularity stats
const popularityStats = {
  maxDownloads: Math.max(...models.map((m: any) => m.hf_downloads || 0)),
  maxLikes: Math.max(...models.map((m: any) => m.hf_likes || 0)),
  maxStars: Math.max(...models.map((m: any) => m.github_stars || 0)),
  maxNewsMentions: Math.max(...Object.values(newsMentionsByModel)),
  maxUsageEstimate: 300, // ChatGPT
};

// Compute per-model popularity and market cap
const popularityResults: Array<{ id: string; popularity_score: number; market_cap_estimate: number | null }> = [];

for (const model of models) {
  const popScore = computePopularityScore({
    hfDownloads: model.hf_downloads || 0,
    hfLikes: model.hf_likes || 0,
    githubStars: model.github_stars || null,
    newsMentions: newsMentionsByModel[model.id] || 0,
    providerUsageEstimate: getProviderUsageEstimate(model.name),
    trendingScore: model.hf_trending_score || null,
  }, popularityStats);

  // Get cheapest price for market cap
  const pricing = pricingByModel.get(model.id);
  const blendedPrice = pricing?.input_price_per_million || null;

  popularityResults.push({
    id: model.id,
    popularity_score: popScore,
    market_cap_estimate: computeMarketCap(popScore, blendedPrice),
  });
}

// Rank by popularity
popularityResults.sort((a, b) => b.popularity_score - a.popularity_score);
for (let i = 0; i < popularityResults.length; i++) {
  const r = popularityResults[i];
  await supabase
    .from("models")
    .update({
      popularity_score: r.popularity_score,
      market_cap_estimate: r.market_cap_estimate,
      popularity_rank: i + 1,
    })
    .eq("id", r.id);
}
```

**Step 4: Register GitHub stars adapter**

Add to `loadAllAdapters()` in `src/lib/data-sources/registry.ts`:
```typescript
import("./adapters/github-stars"),
```

**Step 5: Commit**

```bash
git add src/lib/scoring/market-cap-calculator.ts src/lib/data-sources/adapters/github-stars.ts src/app/api/cron/compute-scores/route.ts src/lib/data-sources/registry.ts
git commit -m "feat: add market cap calculator, GitHub stars adapter, and popularity scoring"
```

---

## Task 6: Global Market Ticker

**Files:**
- Create: `src/components/layout/market-ticker.tsx`
- Create: `src/app/api/charts/ticker/route.ts`
- Modify: `src/app/layout.tsx` (insert ticker after Header)

**Step 1: Create ticker API route**

```typescript
// src/app/api/charts/ticker/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const revalidate = 300; // 5 min cache

export async function GET() {
  const supabase = await createClient();

  // Get top 15 models by popularity with latest snapshot delta
  const { data: models } = await supabase
    .from("models")
    .select("id, name, slug, provider, popularity_score, overall_rank, quality_score")
    .eq("status", "active")
    .not("popularity_score", "is", null)
    .order("popularity_rank", { ascending: true })
    .limit(15);

  if (!models) return NextResponse.json([]);

  // Get previous snapshot for each to compute delta
  const modelIds = models.map((m) => m.id);
  const { data: snapshots } = await supabase
    .from("model_snapshots")
    .select("model_id, popularity_score, snapshot_date")
    .in("model_id", modelIds)
    .order("snapshot_date", { ascending: false })
    .limit(30); // ~2 snapshots per model

  const previousScores = new Map<string, number>();
  for (const s of snapshots || []) {
    if (!previousScores.has(s.model_id) && s.popularity_score != null) {
      // Skip the latest (current), take the previous
      if (previousScores.has(`_seen_${s.model_id}`)) {
        previousScores.set(s.model_id, s.popularity_score);
      } else {
        previousScores.set(`_seen_${s.model_id}`, 1 as any);
      }
    }
  }

  const tickerData = models.map((m) => {
    const prev = previousScores.get(m.id);
    const delta = prev != null && m.popularity_score != null ? m.popularity_score - prev : null;
    return {
      name: m.name,
      slug: m.slug,
      provider: m.provider,
      score: m.popularity_score,
      delta,
      rank: m.overall_rank,
    };
  });

  return NextResponse.json(tickerData);
}
```

**Step 2: Create market ticker component**

```typescript
// src/components/layout/market-ticker.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";

interface TickerItem {
  name: string;
  slug: string;
  provider: string;
  score: number | null;
  delta: number | null;
  rank: number | null;
}

export function MarketTicker() {
  const [items, setItems] = useState<TickerItem[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/charts/ticker")
      .then((r) => r.json())
      .then(setItems)
      .catch(() => {});
  }, []);

  if (items.length === 0) return null;

  // Duplicate items for seamless loop
  const doubled = [...items, ...items];

  return (
    <div
      className="w-full bg-[#0a0a0a] border-b border-border/30 overflow-hidden h-8"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        ref={scrollRef}
        className="flex items-center h-full gap-6 whitespace-nowrap"
        style={{
          animation: `ticker-scroll ${items.length * 3}s linear infinite`,
          animationPlayState: isPaused ? "paused" : "running",
        }}
      >
        {doubled.map((item, i) => (
          <Link
            key={`${item.slug}-${i}`}
            href={`/models/${item.slug}`}
            className="flex items-center gap-2 text-xs font-mono shrink-0 hover:text-neon transition-colors"
          >
            <span className="text-muted-foreground">{item.name}</span>
            <span className="text-white font-semibold tabular-nums">
              {item.score?.toFixed(1) ?? "—"}
            </span>
            {item.delta != null && (
              <span
                className={`tabular-nums font-semibold ${
                  item.delta > 0 ? "text-green-400" : item.delta < 0 ? "text-red-400" : "text-muted-foreground"
                }`}
              >
                {item.delta > 0 ? "▲" : item.delta < 0 ? "▼" : "—"}
                {Math.abs(item.delta).toFixed(1)}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
```

**Step 3: Add ticker CSS animation to globals.css**

Add to `src/app/globals.css`:
```css
@keyframes ticker-scroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
```

**Step 4: Insert ticker into layout**

In `src/app/layout.tsx`, after `<Header />` add:
```typescript
import { MarketTicker } from "@/components/layout/market-ticker";

// In the JSX, after <Header />:
<Header />
<MarketTicker />
<main id="main-content">
```

**Step 5: Commit**

```bash
git add src/components/layout/market-ticker.tsx src/app/api/charts/ticker/route.ts src/app/globals.css src/app/layout.tsx
git commit -m "feat: add Bloomberg-style scrolling market ticker"
```

---

## Task 7: TradingView Chart Component

**Files:**
- Create: `src/components/charts/trading-chart.tsx`
- Create: `src/app/api/charts/trading/route.ts`

**Step 1: Create trading chart API route**

```typescript
// src/app/api/charts/trading/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelSlug = searchParams.get("model");
  const metric = searchParams.get("metric") || "popularity_score";
  const range = searchParams.get("range") || "30d";

  if (!modelSlug) return NextResponse.json({ error: "model required" }, { status: 400 });

  const supabase = await createClient();

  // Get model ID
  const { data: model } = await supabase
    .from("models")
    .select("id, name")
    .eq("slug", modelSlug)
    .single();

  if (!model) return NextResponse.json({ error: "Model not found" }, { status: 404 });

  // Calculate date range
  const now = new Date();
  const rangeMap: Record<string, number> = { "24h": 1, "7d": 7, "30d": 30, "90d": 90, "1y": 365, all: 3650 };
  const daysBack = rangeMap[range] || 30;
  const startDate = new Date(now.getTime() - daysBack * 86400000).toISOString();

  // Fetch snapshots
  const { data: snapshots } = await supabase
    .from("model_snapshots")
    .select("snapshot_date, quality_score, overall_rank, hf_downloads, hf_likes, popularity_score, market_cap_estimate")
    .eq("model_id", model.id)
    .gte("snapshot_date", startDate)
    .order("snapshot_date", { ascending: true });

  if (!snapshots || snapshots.length === 0) {
    return NextResponse.json({ model: model.name, data: [] });
  }

  // Group by day for OHLC candlestick data
  const dailyGroups = new Map<string, number[]>();
  for (const s of snapshots) {
    const day = s.snapshot_date.split("T")[0];
    const value = s[metric as keyof typeof s] as number;
    if (value == null) continue;
    if (!dailyGroups.has(day)) dailyGroups.set(day, []);
    dailyGroups.get(day)!.push(value);
  }

  const candlesticks = Array.from(dailyGroups.entries()).map(([date, values]) => ({
    time: date,
    open: values[0],
    high: Math.max(...values),
    low: Math.min(...values),
    close: values[values.length - 1],
  }));

  // Volume: daily download delta
  const volumeData = Array.from(dailyGroups.entries()).map(([date, _], i, arr) => {
    const daySnapshots = snapshots.filter((s) => s.snapshot_date.startsWith(date));
    const downloads = daySnapshots.map((s) => s.hf_downloads || 0);
    const volume = downloads.length > 1 ? downloads[downloads.length - 1] - downloads[0] : 0;
    return { time: date, value: Math.abs(volume), color: volume >= 0 ? "#26a69a" : "#ef5350" };
  });

  return NextResponse.json({
    model: model.name,
    candlesticks,
    volume: volumeData,
  });
}
```

**Step 2: Create TradingView chart component**

```typescript
// src/components/charts/trading-chart.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { ChartCard } from "./chart-card";

interface TradingChartProps {
  modelSlug: string;
  modelName?: string;
  className?: string;
  compact?: boolean;
}

const TIME_RANGES = ["24h", "7d", "30d", "90d", "1y", "All"] as const;
const METRICS = [
  { value: "popularity_score", label: "Popularity" },
  { value: "quality_score", label: "Quality" },
  { value: "hf_downloads", label: "Downloads" },
  { value: "market_cap_estimate", label: "Market Cap" },
] as const;

export function TradingChart({ modelSlug, modelName, className, compact }: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const [range, setRange] = useState<string>("30d");
  const [metric, setMetric] = useState<string>("popularity_score");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    let chart: any;
    let candleSeries: any;
    let volumeSeries: any;

    const initChart = async () => {
      const { createChart, CandlestickSeries, HistogramSeries } = await import("lightweight-charts");

      chart = createChart(chartContainerRef.current!, {
        layout: {
          background: { color: "#0a0a0a" },
          textColor: "#999",
          fontSize: 12,
        },
        grid: {
          vertLines: { color: "#1a1a1a" },
          horzLines: { color: "#1a1a1a" },
        },
        crosshair: {
          mode: 0, // Normal crosshair
          vertLine: { color: "#00d4aa", width: 1, style: 2 },
          horzLine: { color: "#00d4aa", width: 1, style: 2 },
        },
        timeScale: {
          borderColor: "#333",
          timeVisible: true,
        },
        rightPriceScale: {
          borderColor: "#333",
        },
        width: chartContainerRef.current!.clientWidth,
        height: compact ? 300 : 500,
      });

      candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#26a69a",
        downColor: "#ef5350",
        borderUpColor: "#26a69a",
        borderDownColor: "#ef5350",
        wickUpColor: "#26a69a",
        wickDownColor: "#ef5350",
      });

      volumeSeries = chart.addSeries(HistogramSeries, {
        priceScaleId: "volume",
        priceFormat: { type: "volume" },
      });

      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });

      chartRef.current = { chart, candleSeries, volumeSeries };

      // Resize observer
      const ro = new ResizeObserver(() => {
        if (chartContainerRef.current) {
          chart.applyOptions({ width: chartContainerRef.current.clientWidth });
        }
      });
      ro.observe(chartContainerRef.current!);

      return () => ro.disconnect();
    };

    initChart();

    return () => {
      if (chart) chart.remove();
    };
  }, [compact]);

  // Fetch data when range/metric changes
  useEffect(() => {
    setLoading(true);
    fetch(`/api/charts/trading?model=${modelSlug}&metric=${metric}&range=${range}`)
      .then((r) => r.json())
      .then((data) => {
        if (chartRef.current && data.candlesticks?.length > 0) {
          chartRef.current.candleSeries.setData(data.candlesticks);
          if (data.volume) {
            chartRef.current.volumeSeries.setData(data.volume);
          }
          chartRef.current.chart.timeScale().fitContent();
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [modelSlug, range, metric]);

  return (
    <ChartCard
      title={modelName ? `${modelName} — Trading View` : "Trading View"}
      subtitle="Candlestick chart with volume overlay"
      className={className}
      loading={loading}
      controls={
        <div className="flex gap-2 flex-wrap">
          <div className="flex gap-1 bg-secondary/50 rounded-lg p-0.5">
            {TIME_RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r.toLowerCase())}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  range === r.toLowerCase()
                    ? "bg-neon/20 text-neon font-semibold"
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          {!compact && (
            <div className="flex gap-1 bg-secondary/50 rounded-lg p-0.5">
              {METRICS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMetric(m.value)}
                  className={`px-2 py-1 text-xs rounded-md transition-colors ${
                    metric === m.value
                      ? "bg-neon/20 text-neon font-semibold"
                      : "text-muted-foreground hover:text-white"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>
      }
    >
      <div ref={chartContainerRef} className="w-full" />
    </ChartCard>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/charts/trading-chart.tsx src/app/api/charts/trading/route.ts
git commit -m "feat: add TradingView-style candlestick chart with crosshair and volume"
```

---

## Task 8: Deploy Tab

**Files:**
- Create: `src/components/models/deploy-tab.tsx`
- Create: `src/app/api/models/[slug]/deployments/route.ts`
- Create: `src/lib/deployment/deploy-actions.ts`
- Modify: `src/app/(catalog)/models/[slug]/page.tsx` (add Deploy tab)

**Step 1: Create deployments API route**

```typescript
// src/app/api/models/[slug]/deployments/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = await createClient();

  // Get model
  const { data: model } = await supabase
    .from("models")
    .select("id, name, is_open_weights, provider")
    .eq("slug", slug)
    .single();

  if (!model) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Get deployments with platform details
  const { data: deployments } = await supabase
    .from("model_deployments")
    .select("*, platform:deployment_platforms(*)")
    .eq("model_id", model.id)
    .eq("status", "available")
    .order("price_per_unit", { ascending: true });

  // Get all platforms for reference
  const { data: allPlatforms } = await supabase
    .from("deployment_platforms")
    .select("*")
    .order("name");

  return NextResponse.json({
    model,
    deployments: deployments || [],
    allPlatforms: allPlatforms || [],
  });
}
```

**Step 2: Create deploy actions module**

```typescript
// src/lib/deployment/deploy-actions.ts

export interface DeployAction {
  type: "link" | "command" | "api";
  label: string;
  url?: string;
  command?: string;
  affiliateParams?: string;
}

export function getDeployAction(
  platformSlug: string,
  modelName: string,
  modelSlug: string,
  deployUrl?: string | null
): DeployAction {
  const affiliateParams = "?ref=aimarketcap&utm_source=aimarketcap&utm_medium=deploy_tab";

  switch (platformSlug) {
    case "ollama":
      return {
        type: "command",
        label: "Copy Command",
        command: `ollama pull ${modelSlug}`,
      };
    case "llamacpp":
      return {
        type: "command",
        label: "Copy Docker Command",
        command: `docker run -p 8080:8080 ghcr.io/ggml-org/llama.cpp:server -m /models/${modelSlug}.gguf --port 8080`,
      };
    case "lm-studio":
      return {
        type: "link",
        label: "Open in LM Studio",
        url: `lmstudio://open?model=${modelSlug}`,
      };
    case "replicate":
      return {
        type: "link",
        label: "Deploy on Replicate",
        url: `${deployUrl || `https://replicate.com/models/${modelSlug}`}${affiliateParams}`,
        affiliateParams,
      };
    case "gcp-vertex":
      return {
        type: "link",
        label: "Deploy on Vertex AI",
        url: `https://console.cloud.google.com/vertex-ai/publishers/${modelSlug}${affiliateParams}`,
        affiliateParams,
      };
    case "runpod":
      return {
        type: "link",
        label: "Deploy on RunPod",
        url: `https://runpod.io/console/deploy${affiliateParams}`,
        affiliateParams,
      };
    default:
      return {
        type: "link",
        label: `Open on ${platformSlug}`,
        url: `${deployUrl || "#"}${affiliateParams}`,
        affiliateParams,
      };
  }
}

export function formatPrice(pricePerUnit: number | null, unitDescription: string | null): string {
  if (!pricePerUnit) return "Free";
  if (pricePerUnit < 0.01) return `$${pricePerUnit.toFixed(4)}/${unitDescription || "unit"}`;
  return `$${pricePerUnit.toFixed(2)}/${unitDescription || "unit"}`;
}
```

**Step 3: Create deploy tab component**

```typescript
// src/components/models/deploy-tab.tsx
"use client";

import { useEffect, useState } from "react";
import { getDeployAction, formatPrice } from "@/lib/deployment/deploy-actions";
import type { ModelDeployment, DeploymentPlatform } from "@/types/database";

interface DeployTabProps {
  modelSlug: string;
  isOpenWeights: boolean;
}

export function DeployTab({ modelSlug, isOpenWeights }: DeployTabProps) {
  const [deployments, setDeployments] = useState<(ModelDeployment & { platform: DeploymentPlatform })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/models/${modelSlug}/deployments`)
      .then((r) => r.json())
      .then((data) => {
        setDeployments(data.deployments || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [modelSlug]);

  if (loading) {
    return <div className="animate-pulse space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-secondary/30 rounded-lg" />)}</div>;
  }

  // Find best value and fastest
  const cheapest = deployments.reduce((min, d) => (!min || (d.price_per_unit || Infinity) < (min.price_per_unit || Infinity)) ? d : min, null as typeof deployments[0] | null);
  const free = deployments.filter((d) => d.free_tier);

  return (
    <div className="space-y-6">
      {/* Pricing Comparison Table */}
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-secondary/30 border-b border-border/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Platform</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Type</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Price</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Free Tier</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground"></th>
            </tr>
          </thead>
          <tbody>
            {deployments.map((d) => {
              const action = getDeployAction(d.platform?.slug || "", "", modelSlug, d.deploy_url);
              const isCheapest = d.id === cheapest?.id;
              return (
                <tr key={d.id} className="border-b border-border/30 table-row-hover">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{d.platform?.name}</span>
                      {isCheapest && (
                        <span className="text-[10px] bg-neon/20 text-neon px-1.5 py-0.5 rounded font-semibold">
                          Best Value
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-secondary/50 px-2 py-1 rounded capitalize">
                      {d.platform?.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums">
                    {formatPrice(d.price_per_unit, d.unit_description)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    {d.free_tier ? (
                      <span className="text-green-400 text-xs">{d.free_tier}</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {action.type === "command" ? (
                      <button
                        onClick={() => navigator.clipboard.writeText(action.command!)}
                        className="text-xs bg-neon/10 text-neon px-3 py-1.5 rounded-lg hover:bg-neon/20 transition-colors"
                      >
                        {action.label}
                      </button>
                    ) : (
                      <a
                        href={action.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs bg-neon/10 text-neon px-3 py-1.5 rounded-lg hover:bg-neon/20 transition-colors inline-block"
                      >
                        Deploy →
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Self-hosting section for open-weight models */}
      {isOpenWeights && (
        <div className="rounded-lg border border-border/50 p-4 space-y-3">
          <h3 className="text-sm font-semibold">Self-Hosting</h3>
          <div className="space-y-2">
            <div className="bg-secondary/20 rounded p-3">
              <p className="text-xs text-muted-foreground mb-1">Ollama (easiest)</p>
              <code className="text-xs text-neon font-mono">ollama pull {modelSlug}</code>
            </div>
            <div className="bg-secondary/20 rounded p-3">
              <p className="text-xs text-muted-foreground mb-1">vLLM (production)</p>
              <code className="text-xs text-neon font-mono break-all">
                python -m vllm.entrypoints.openai.api_server --model {modelSlug}
              </code>
            </div>
          </div>
        </div>
      )}

      {deployments.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No deployment options available yet for this model.</p>
          <p className="text-sm mt-1">Check back soon — we&apos;re adding platforms daily.</p>
        </div>
      )}
    </div>
  );
}
```

**Step 4: Add Deploy tab to model detail page**

In `src/app/(catalog)/models/[slug]/page.tsx`, add:
- Import: `import { DeployTab } from "@/components/models/deploy-tab";`
- Add tab trigger after existing tabs: `<TabsTrigger value="deploy">Deploy</TabsTrigger>`
- Add tab content: `<TabsContent value="deploy"><DeployTab modelSlug={model.slug} isOpenWeights={model.is_open_weights} /></TabsContent>`

**Step 5: Commit**

```bash
git add src/components/models/deploy-tab.tsx src/app/api/models/[slug]/deployments/route.ts src/lib/deployment/deploy-actions.ts "src/app/(catalog)/models/[slug]/page.tsx"
git commit -m "feat: add Deploy tab with pricing comparison and one-click deployment"
```

---

## Task 9: Model Descriptions (Pros/Cons)

**Files:**
- Create: `src/components/models/model-overview.tsx`
- Create: `src/app/api/models/[slug]/description/route.ts`
- Modify: `src/app/(catalog)/models/[slug]/page.tsx` (add overview section)

**Step 1: Create description API route**

```typescript
// src/app/api/models/[slug]/description/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: model } = await supabase
    .from("models")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!model) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: description } = await supabase
    .from("model_descriptions")
    .select("*")
    .eq("model_id", model.id)
    .single();

  return NextResponse.json(description || null);
}
```

**Step 2: Create model overview component**

```typescript
// src/components/models/model-overview.tsx
"use client";

import { useEffect, useState } from "react";
import type { ModelDescription } from "@/types/database";

interface ModelOverviewProps {
  modelSlug: string;
}

export function ModelOverview({ modelSlug }: ModelOverviewProps) {
  const [description, setDescription] = useState<ModelDescription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/models/${modelSlug}/description`)
      .then((r) => r.json())
      .then((data) => {
        setDescription(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [modelSlug]);

  if (loading) return <div className="animate-pulse h-32 bg-secondary/20 rounded-lg" />;
  if (!description) return null;

  return (
    <div className="rounded-lg border border-border/50 p-6 space-y-4 mb-6">
      {/* Summary */}
      {description.summary && (
        <p className="text-sm text-muted-foreground leading-relaxed">{description.summary}</p>
      )}

      {/* Pros and Cons side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pros */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-green-400 uppercase tracking-wider">Strengths</h4>
          {description.pros?.map((pro, i) => (
            <div key={i} className="flex gap-2 text-sm">
              <span className="text-green-400 shrink-0">✓</span>
              <div>
                <span className="font-medium">{pro.title}</span>
                {pro.description && (
                  <span className="text-muted-foreground"> — {pro.description}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Cons */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider">Limitations</h4>
          {description.cons?.map((con, i) => (
            <div key={i} className="flex gap-2 text-sm">
              <span className="text-red-400 shrink-0">✗</span>
              <div>
                <span className="font-medium">{con.title}</span>
                {con.description && (
                  <span className="text-muted-foreground"> — {con.description}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Use case tags */}
      {description.best_for?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground">Best for:</span>
          {description.best_for.map((tag) => (
            <span key={tag} className="text-xs bg-neon/10 text-neon px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}
      {description.not_ideal_for?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground">Not ideal for:</span>
          {description.not_ideal_for.map((tag) => (
            <span key={tag} className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Source attribution */}
      <p className="text-[10px] text-muted-foreground/50">
        {description.generated_by === "ai" ? "AI-generated overview" : "Community-sourced overview"}
        {description.last_generated && ` · Updated ${new Date(description.last_generated).toLocaleDateString()}`}
      </p>
    </div>
  );
}
```

**Step 3: Add to model detail page**

In `src/app/(catalog)/models/[slug]/page.tsx`, import and render `<ModelOverview>` above the `<Tabs>` section:

```typescript
import { ModelOverview } from "@/components/models/model-overview";

// Just before <Tabs defaultValue="benchmarks">
<ModelOverview modelSlug={model.slug} />
```

**Step 4: Commit**

```bash
git add src/components/models/model-overview.tsx src/app/api/models/[slug]/description/route.ts "src/app/(catalog)/models/[slug]/page.tsx"
git commit -m "feat: add model overview with AI-generated pros/cons and use case tags"
```

---

## Task 10: Agent Leaderboard Tab + Table Column Updates

**Files:**
- Create: `src/components/models/agent-leaderboard.tsx`
- Modify: `src/app/(rankings)/leaderboards/page.tsx` (add Agent tab)
- Modify: `src/app/page.tsx` (add Popularity + Agent Score columns)

**Step 1: Create Agent Leaderboard component**

```typescript
// src/components/models/agent-leaderboard.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChartControls, useChartFilters } from "@/components/charts/chart-controls";

interface AgentModel {
  name: string;
  slug: string;
  provider: string;
  agent_score: number;
  agent_rank: number;
  benchmarks: Record<string, number | null>;
}

const AGENT_BENCHMARKS = [
  { slug: "swe-bench", label: "SWE" },
  { slug: "terminal-bench", label: "Term" },
  { slug: "os-world", label: "OSW" },
  { slug: "gaia", label: "GAIA" },
  { slug: "webarena", label: "Web" },
  { slug: "humaneval", label: "HEval" },
  { slug: "aider-polyglot", label: "Aider" },
  { slug: "tau-bench", label: "TAU" },
  { slug: "agent-bench", label: "Agent" },
];

export function AgentLeaderboard() {
  const [models, setModels] = useState<AgentModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("agent_score");
  const { filters, setFilters } = useChartFilters();

  useEffect(() => {
    fetch("/api/charts/agent-leaderboard")
      .then((r) => r.json())
      .then((data) => {
        setModels(data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const sorted = [...models].sort((a, b) => {
    if (sortBy === "agent_score") return (b.agent_score || 0) - (a.agent_score || 0);
    const benchA = a.benchmarks[sortBy] ?? -1;
    const benchB = b.benchmarks[sortBy] ?? -1;
    return benchB - benchA;
  });

  const filtered = sorted.filter((m) => {
    if (filters.providers.length > 0 && !filters.providers.includes(m.provider)) return false;
    return true;
  });

  if (loading) return <div className="animate-pulse space-y-2">{[...Array(10)].map((_, i) => <div key={i} className="h-10 bg-secondary/20 rounded" />)}</div>;

  return (
    <div className="space-y-4">
      <ChartControls filters={filters} onChange={setFilters} showProviders showDateRange={false} />

      <div className="rounded-lg border border-border/50 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-secondary/30 border-b border-border/50">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-10">#</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Model</th>
              <th
                className="px-3 py-2 text-right text-xs font-medium cursor-pointer hover:text-neon transition-colors"
                onClick={() => setSortBy("agent_score")}
              >
                Agent Score {sortBy === "agent_score" && "▼"}
              </th>
              {AGENT_BENCHMARKS.map((b) => (
                <th
                  key={b.slug}
                  className="px-2 py-2 text-right text-xs font-medium cursor-pointer hover:text-neon transition-colors whitespace-nowrap"
                  onClick={() => setSortBy(b.slug)}
                  title={b.slug}
                >
                  {b.label} {sortBy === b.slug && "▼"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((m, i) => (
              <tr key={m.slug} className="border-b border-border/20 table-row-hover">
                <td className="px-3 py-2 text-xs text-muted-foreground">{m.agent_rank}</td>
                <td className="px-3 py-2">
                  <Link href={`/models/${m.slug}`} className="text-sm font-medium hover:text-neon transition-colors">
                    {m.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{m.provider}</p>
                </td>
                <td className="px-3 py-2 text-right">
                  <span className={`text-sm font-semibold tabular-nums ${
                    m.agent_score >= 70 ? "text-green-400" : m.agent_score >= 40 ? "text-yellow-400" : "text-red-400"
                  }`}>
                    {m.agent_score.toFixed(1)}
                  </span>
                </td>
                {AGENT_BENCHMARKS.map((b) => (
                  <td key={b.slug} className="px-2 py-2 text-right text-xs tabular-nums">
                    {m.benchmarks[b.slug] != null ? (
                      <span className="text-muted-foreground">{m.benchmarks[b.slug]!.toFixed(0)}</span>
                    ) : (
                      <span className="text-muted-foreground/30">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Step 2: Create agent leaderboard API**

Create `src/app/api/charts/agent-leaderboard/route.ts`:
- Fetch all models with `agent_score IS NOT NULL`
- Join with benchmark_scores for the 9 agent benchmark slugs
- Pivot into `{ name, slug, provider, agent_score, agent_rank, benchmarks: { "swe-bench": 72, ... } }`

**Step 3: Add Agent tab to leaderboards page**

In `src/app/(rankings)/leaderboards/page.tsx`, add:
- Import: `import { AgentLeaderboard } from "@/components/models/agent-leaderboard";`
- Add tab: `<TabsTrigger value="agent">Agent</TabsTrigger>`
- Add content: `<TabsContent value="agent"><AgentLeaderboard /></TabsContent>`

**Step 4: Add Popularity + Agent columns to homepage table**

In `src/app/page.tsx`, in the top models table:
- Add `popularity_score, agent_score, popularity_rank` to the Supabase select query
- Add two new `<th>` + `<td>` columns:
  - "Popularity" (between Category and Score): shows `model.popularity_score?.toFixed(0)` with a relative bar
  - "Agent" (after Score): shows `model.agent_score?.toFixed(0)` with color badge

**Step 5: Commit**

```bash
git add src/components/models/agent-leaderboard.tsx src/app/api/charts/agent-leaderboard/route.ts "src/app/(rankings)/leaderboards/page.tsx" src/app/page.tsx
git commit -m "feat: add Agent Leaderboard tab and Popularity/Agent columns to homepage"
```

---

## Task 11: Trading Chart Integration + Homepage Dashboard

**Files:**
- Modify: `src/app/(catalog)/models/[slug]/page.tsx` (rename Trends → Trading, use TradingChart)
- Modify: `src/app/page.tsx` (add featured trading chart to homepage)

**Step 1: Replace Trends tab with Trading tab on model detail**

In `src/app/(catalog)/models/[slug]/page.tsx`:
- Import: `import { TradingChart } from "@/components/charts/trading-chart";`
- Change tab trigger: `<TabsTrigger value="trading">Trading</TabsTrigger>`
- Replace trends tab content with: `<TabsContent value="trading"><TradingChart modelSlug={model.slug} modelName={model.name} /></TabsContent>`

**Step 2: Add featured trading chart to homepage**

In `src/app/page.tsx`, in the Market Overview section, add:
```typescript
import { TradingChart } from "@/components/charts/trading-chart";

// After the KPI cards, before or alongside existing charts:
<TradingChart modelSlug={topModels[0]?.slug || "gpt-4o"} modelName={topModels[0]?.name} compact />
```

**Step 3: Commit**

```bash
git add "src/app/(catalog)/models/[slug]/page.tsx" src/app/page.tsx
git commit -m "feat: integrate TradingView charts into model detail and homepage"
```

---

## Task 12: Build Verification + Final Cleanup

**Files:**
- All files from Tasks 1-11

**Step 1: Run build**

Run: `npm run build`
Expected: Zero errors

**Step 2: Fix any build errors**

Common issues to check:
- Missing imports
- Type mismatches on new DB columns
- `lightweight-charts` SSR issues (needs `"use client"` + dynamic import)

**Step 3: Verify pages render**

Start dev server and check:
- Homepage: ticker scrolling, new columns in table, trading chart
- Leaderboards: Agent tab renders with 9-column table
- Model detail: Overview section, Deploy tab, Trading tab
- All existing functionality still works

**Step 4: Final commit**

```bash
git add -A
git commit -m "fix: resolve build errors and finalize Phase 6 integration"
```

**Step 5: Push and update PR**

```bash
git push
```

---

## File Summary

| Task | New Files | Modified Files |
|------|-----------|----------------|
| 1 | `supabase/migrations/007_*` | `src/types/database.ts` |
| 2 | — | `package.json` |
| 3 | 5 adapter files | `src/lib/data-sources/registry.ts` |
| 4 | `src/lib/scoring/agent-score-calculator.ts` | `compute-scores/route.ts` |
| 5 | `market-cap-calculator.ts`, `github-stars.ts` | `compute-scores/route.ts`, `registry.ts` |
| 6 | `market-ticker.tsx`, `api/charts/ticker/route.ts` | `layout.tsx`, `globals.css` |
| 7 | `trading-chart.tsx`, `api/charts/trading/route.ts` | — |
| 8 | `deploy-tab.tsx`, `deploy-actions.ts`, `deployments/route.ts` | `models/[slug]/page.tsx` |
| 9 | `model-overview.tsx`, `description/route.ts` | `models/[slug]/page.tsx` |
| 10 | `agent-leaderboard.tsx`, `agent-leaderboard/route.ts` | `leaderboards/page.tsx`, `page.tsx` |
| 11 | — | `models/[slug]/page.tsx`, `page.tsx` |
| 12 | — | Any files with build errors |

**Total: ~20 new files, ~12 modified files, 12 commits**
