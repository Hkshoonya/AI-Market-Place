# Multi-Lens Scoring & Ranking Redesign

**Date:** 2026-03-02
**Status:** Approved
**Budget:** $0 incremental (uses existing Supabase + pg_cron)

## Problem Statement

The current scoring system has four critical issues:
1. **Overrated niche models** — coverage penalty too soft (sqrt with 0.25 floor), static signals inflate coverage count
2. **Open vs proprietary bias** — shared normalization pool; hardcoded provider MAU drowns HF signals
3. **Unrealistic market cap** — `popularity^1.5 * price * 1400` produces nonsensical numbers; price dependency makes free models invisible
4. **Broken category rankings** — same composite weights for all categories; image gen models ranked by LLM-heavy signals

## Solution: 4 Ranking Lenses

Replace the single `overall_rank` with 4 independent ranking modes. Default view is **Capability**. Users can toggle between lenses.

---

### Lens 1: Capability Ranking (Default)

Pure performance ranking. No popularity or market signals.

**Formula:**
```
capabilityScore = weightedBenchmarks * 0.60
                + normalizedELO * 0.30
                + recencyBonus * 0.10
```

**Rules:**
- Models with ZERO benchmarks AND zero ELO are **unranked** (displayed as "—")
- ELO absorbs benchmark weight when benchmarks are missing (same as current)
- Category-specific benchmark selection:

| Category | Primary Benchmarks (70% of benchmark weight) | Secondary (30%) |
|----------|----------------------------------------------|-----------------|
| LLM | MMLU, GPQA, Math, BBH | IFEval, HellaSwag, TruthfulQA |
| Code | HumanEval, SWE-bench, BigCodeBench | LiveBench-coding |
| Multimodal | MMMU, MathVista, OCRBench | MMLU, GPQA |
| Image Gen | ELO (arena), Community preference | Recency only |
| Agentic | SWE-bench, TerminalBench, OSWorld | GAIA, WebArena, TAU-bench |

---

### Lens 2: Usage Ranking

Adoption-weighted. "What are people actually using?"

**Formula:**
```
usageScore = downloads_norm * 0.30
           + providerMAU_norm * 0.20
           + stars_norm * 0.15
           + news_norm * 0.15
           + trending_norm * 0.10
           + likes_norm * 0.10
```

**Key design:**
- **Separate normalization pools** for open vs proprietary models
  - Open models: normalized against max(open_downloads, open_likes, open_stars)
  - Proprietary: normalized against max(proprietary_MAU, proprietary_news)
  - Final scores are comparable because both pools produce 0-100
- **No coverage penalty** — missing signals contribute 0, remaining reweighted

---

### Lens 3: Expert Consensus Ranking

"What would AI researchers agree on?"

**Formula:**
```
expertScore = benchmarks * 0.35 + elo * 0.25     // 60% hard evidence
            + communitySignal * 0.20              // researcher engagement
            + citationProxy * 0.10                // academic impact
            + recency * 0.10                      // frontier bonus
```

Where:
- `communitySignal` = blend of HF likes (researcher endorsement), GitHub stars (developer endorsement), news
- `citationProxy` = provider reputation (avg benchmark of sibling models from same provider)
- `recency` = exponential decay, 12-month half-life

---

### Lens 4: Balanced Composite Ranking

Meta-ranking blending the other three lenses plus value.

**Formula:**
```
balancedRank = capabilityRank * 0.35
             + usageRank * 0.35
             + expertRank * 0.20
             + valueRank * 0.10
```

**Category-specific balanced weights:**

| Category | Capability | Usage | Expert | Value |
|----------|-----------|-------|--------|-------|
| LLM | 35% | 30% | 25% | 10% |
| Code | 40% | 25% | 25% | 10% |
| Image Gen | 20% | 40% | 30% | 10% |
| Multimodal | 35% | 30% | 25% | 10% |
| Agentic | 40% | 25% | 25% | 10% |

---

## Bug Fixes

### Fix 1: Coverage Penalty Overhaul

**Signals classified as:**
- **Quality evidence** (counts for coverage): benchmarks, ELO, downloads, likes, stars, news
- **Attributes** (never counts for coverage): openness, recency

**New discrete step penalty:**
```
evidenceCount == 0 → unranked (score = 0)
evidenceCount == 1 → penalty = 0.40
evidenceCount == 2 → penalty = 0.65
evidenceCount == 3 → penalty = 0.85
evidenceCount >= 4 → penalty = 1.00
```

### Fix 2: Open vs Proprietary Normalization

Two normalization pools. Open models normalized against open max, proprietary against proprietary max. Eliminates the bias where hardcoded 400M MAU for OpenAI drowns HF download signals.

### Fix 3: Market Cap Formula (Revised — keeps price)

```
marketCap = adoptionScore^1.2 * priceWeight * SCALE_FACTOR
```

Where:
- `adoptionScore` = Usage lens score (0-100)
- `priceWeight` = `log10(blendedPrice + 1) / log10(20 + 1)` — log-normalized, price matters but doesn't dominate
- `SCALE_FACTOR` = calibrated so GPT-4o ≈ $200M/month
- Free/open models: `max(blendedPrice, 0.10)` instead of 0.01
- Exponent 1.2 instead of 1.5 — less extreme winner-take-all

### Fix 4: Category-Specific Rankings

Each category uses its own balanced-lens weights (see table above). Image gen gets higher usage weight since benchmarks are sparse.

---

## Pipeline Reliability & Tiered Freshness

### Tiered Sync Schedule

| Tier | Frequency | Sources | Rationale |
|------|-----------|---------|-----------|
| T0: Critical | 2 hours | Provider model catalogs | New model launches are time-sensitive |
| T1: Frequent | 6 hours | HF stats, Chatbot Arena ELO, benchmarks | Core scoring data |
| T2: Daily | 24 hours | GitHub stars, news, pricing sync | Slow-changing signals |
| T3: Weekly | 7 days | Leaderboard crawls (LiveBench, SEAL, BigCode) | Published infrequently |

**Implementation:** pg_cron (free on Supabase):
```sql
SELECT cron.schedule('sync-t0', '0 */2 * * *', $$ SELECT net.http_get(...) $$);
SELECT cron.schedule('sync-t1', '0 */6 * * *', $$ SELECT net.http_get(...) $$);
SELECT cron.schedule('sync-t2', '0 4 * * *', $$ SELECT net.http_get(...) $$);
SELECT cron.schedule('sync-t3', '0 2 * * 0', $$ SELECT net.http_get(...) $$);
```

### Pipeline Health Monitoring

**New table:**
```sql
CREATE TABLE pipeline_health (
  source_slug TEXT PRIMARY KEY,
  last_success_at TIMESTAMPTZ,
  consecutive_failures INT DEFAULT 0,
  expected_interval_hours INT,
  is_stale BOOLEAN GENERATED ALWAYS AS (
    last_success_at < NOW() - (expected_interval_hours * 2 || ' hours')::INTERVAL
  ) STORED
);
```

**Stale data detection** in compute-scores cron:
- Before computing, check stale source count
- Log warning if > 3 sources stale
- Still compute (stale data > no data)

### Coverage Tracking Per Model

Add `signal_coverage JSONB` to `model_snapshots`:
```json
{"benchmarks": true, "elo": true, "downloads": false, "pricing": true}
```

### Data Validation Layer

Validate before writing to DB:
- Score range checks (0-100 for benchmarks, 500-2500 for ELO)
- Anomaly detection (reject > 30% change from last sync unless confirmed)
- Schema validation on adapter output

---

## Database Changes

### New columns on `models` table:
```sql
ALTER TABLE models ADD COLUMN capability_score NUMERIC;
ALTER TABLE models ADD COLUMN capability_rank INT;
ALTER TABLE models ADD COLUMN usage_score NUMERIC;
ALTER TABLE models ADD COLUMN usage_rank INT;
ALTER TABLE models ADD COLUMN expert_score NUMERIC;
ALTER TABLE models ADD COLUMN expert_rank INT;
ALTER TABLE models ADD COLUMN balanced_rank INT;
-- existing: quality_score, overall_rank, popularity_score, popularity_rank, agent_score, agent_rank, market_cap_estimate
```

### New columns on `model_snapshots`:
```sql
ALTER TABLE model_snapshots ADD COLUMN capability_score NUMERIC;
ALTER TABLE model_snapshots ADD COLUMN usage_score NUMERIC;
ALTER TABLE model_snapshots ADD COLUMN expert_score NUMERIC;
ALTER TABLE model_snapshots ADD COLUMN signal_coverage JSONB;
```

### New table: `pipeline_health`
(see schema above)

---

## API Changes

### Updated ranking endpoint:
```
GET /api/rankings?lens=capability&category=llm&limit=50
GET /api/rankings?lens=usage&category=all&limit=50
GET /api/rankings?lens=expert&category=code&limit=20
GET /api/rankings?lens=balanced&category=all&limit=50
```

Default `lens=capability` when not specified.

### Model response includes all scores:
```json
{
  "id": "...",
  "name": "GPT-4o",
  "capabilityScore": 89.2,
  "capabilityRank": 3,
  "usageScore": 95.1,
  "usageRank": 1,
  "expertScore": 91.0,
  "expertRank": 2,
  "balancedRank": 1,
  "marketCapEstimate": 205000000,
  "agentScore": 82.4
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/scoring/quality-calculator.ts` | Refactor into `capability-calculator.ts` + `expert-calculator.ts` |
| `src/lib/scoring/market-cap-calculator.ts` | Fix formula, add `usage-calculator.ts` |
| `src/lib/scoring/agent-score-calculator.ts` | No changes (already independent) |
| `src/app/api/cron/compute-scores/route.ts` | Compute all 4 lenses, update new columns |
| `src/app/api/rankings/route.ts` | Add `lens` query parameter |
| `src/app/api/models/route.ts` | Return all lens scores |
| `src/lib/data-sources/orchestrator.ts` | Add tier parameter, health tracking |
| `supabase/migrations/` | New migration for schema changes |
| UI components (tables, cards) | Lens toggle selector |

## Cost

- **Infrastructure:** $0 incremental (pg_cron free, no new services)
- **API calls:** Same as current (all free APIs)
- **Compute:** Same Supabase Edge Functions
