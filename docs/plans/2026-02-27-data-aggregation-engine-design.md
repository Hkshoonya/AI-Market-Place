# Data Aggregation Engine Design

**Date:** 2026-02-27
**Status:** Approved
**Scope:** Production-grade, config-driven data pipeline for all model/benchmark/news sources

---

## Problem

AI Market Cap has 47 manually seeded models and a single HuggingFace Edge Function (not deployed with cron). To be market-ready, the platform needs automated, resilient ingestion from multiple data sources covering model catalogs, benchmarks, pricing, news, and community activity.

## Requirements

- ALL data source categories implemented (model hubs, proprietary APIs, leaderboards, monitoring, news, community)
- No hardcoded pipelines; configuration-driven via database
- Production-grade: graceful failure, retries, independent source isolation
- Observable: every sync tracked with timing, counts, errors
- Incremental: only fetch new/changed data where possible

## Architecture Decision

| Approach | Verdict |
|----------|---------|
| Supabase Edge Functions (Deno) | Rejected: can't share Node code, separate deploy friction |
| **Next.js API Routes + Vercel Cron** | **Selected**: shared codebase, single deploy, Vercel-native |
| Standalone Worker Service | Rejected: additional infrastructure burden |

API routes with Vercel Cron Jobs. Most adapter syncs complete in <60s. For HuggingFace (5,000 models), chunk across cron invocations using cursor stored in sync_jobs metadata.

## System Flow

```
Vercel Cron (vercel.json)
  |
  v
/api/cron/sync?tier=N  (protected by CRON_SECRET)
  |
  v
Orchestrator (reads data_sources table)
  |
  +-- For each enabled source in tier:
  |     |
  |     v
  |   Registry.getAdapter(adapter_type)
  |     |
  |     v
  |   adapter.sync(context) --> upserts to models/benchmarks/pricing/etc
  |     |
  |     v
  |   sync_jobs record (success/failure/metadata)
  |
  v
Response (JSON summary)
```

## Adapter Interface

```typescript
type SyncOutputType = 'models' | 'benchmarks' | 'pricing' | 'elo_ratings' | 'news' | 'rankings';

interface DataSourceAdapter {
  id: string;
  name: string;
  outputTypes: SyncOutputType[];
  defaultConfig: Record<string, unknown>;

  sync(ctx: SyncContext): Promise<SyncResult>;
  healthCheck(): Promise<HealthCheckResult>;
}

interface SyncContext {
  supabase: SupabaseClient;     // service-role client
  config: Record<string, unknown>;  // from data_sources.config
  secrets: Record<string, string>;  // resolved env vars
  lastSyncAt: string | null;
  signal?: AbortSignal;         // for timeout control
}

interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  errors: { message: string; context?: string }[];
  cursor?: string;              // for chunked syncs
  metadata?: Record<string, unknown>;
}

interface HealthCheckResult {
  healthy: boolean;
  latencyMs: number;
  message?: string;
}
```

## Data Sources (12 Adapters, 4 Tiers)

### Tier 1 - Model Hubs (every 6 hours)

| Adapter | Source | Output | Notes |
|---------|--------|--------|-------|
| huggingface | HF Hub API | models | 5,000 trending, chunked pagination |
| replicate | Replicate API | models | Featured/trending hosted models |
| openai-models | OpenAI /v1/models | models | GPT-4o, o1, DALL-E, Whisper |
| anthropic-models | Static catalog | models | Claude family, update on announcements |
| google-models | Generative AI API | models | Gemini family |

### Tier 2 - Benchmarks & Pricing (every 12 hours)

| Adapter | Source | Output | Notes |
|---------|--------|--------|-------|
| artificial-analysis | Artificial Analysis API | benchmarks, pricing | ARTIFICIAL_ANALYSIS_API_KEY |
| open-llm-leaderboard | HF Spaces dataset | benchmarks | Public dataset API |
| chatbot-arena | LMSYS dataset | elo_ratings | Chatbot Arena Elo scores |

### Tier 3 - News & Research (daily at 08:00 UTC)

| Adapter | Source | Output | Notes |
|---------|--------|--------|-------|
| arxiv | arXiv API | news | cs.CL, cs.AI, cs.LG categories |
| hf-papers | HF Daily Papers API | news | Trending papers |

### Tier 4 - Community (weekly, Monday 00:00 UTC)

| Adapter | Source | Output | Notes |
|---------|--------|--------|-------|
| github-trending | GitHub search API | models (enrichment) | Trending ML repos |
| civitai | Civitai REST API | models | Diffusion model community |

## Database Schema Additions

### data_sources table

```sql
CREATE TABLE data_sources (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  adapter_type TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT true,
  tier INTEGER DEFAULT 1,
  sync_interval_hours INTEGER DEFAULT 6,
  priority INTEGER DEFAULT 50,
  config JSONB DEFAULT '{}',
  secret_env_keys TEXT[] DEFAULT '{}',
  output_types TEXT[] DEFAULT '{}',
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT CHECK (last_sync_status IN ('success', 'partial', 'failed')),
  last_sync_records INTEGER DEFAULT 0,
  last_error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### model_news table (for Tier 3 adapters)

```sql
CREATE TABLE model_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  url TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  category TEXT DEFAULT 'general',
  related_model_ids UUID[],
  related_provider TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source, source_id)
);
```

## File Structure

```
src/lib/data-sources/
  types.ts                      - All interfaces and types
  registry.ts                   - Adapter registry (factory pattern)
  orchestrator.ts               - Sync coordination, error handling, logging
  utils.ts                      - Shared: retry, fetchWithTimeout, rateLimitedFetch, upsertBatch
  adapters/
    huggingface.ts              - HuggingFace Hub API
    replicate.ts                - Replicate model catalog
    openai-models.ts            - OpenAI /v1/models
    anthropic-models.ts         - Anthropic Claude catalog
    google-models.ts            - Google Generative AI
    artificial-analysis.ts      - Benchmark + pricing data
    open-llm-leaderboard.ts     - HF Spaces leaderboard
    chatbot-arena.ts            - LMSYS Elo ratings
    arxiv.ts                    - arXiv papers feed
    hf-papers.ts                - HuggingFace daily papers
    github-trending.ts          - Trending ML GitHub repos
    civitai.ts                  - Civitai diffusion models

src/app/api/
  cron/sync/route.ts            - Vercel Cron endpoint (CRON_SECRET protected)
  admin/data-sources/route.ts   - Admin CRUD for data sources
  admin/sync/route.ts           - Manual trigger + status overview
  admin/sync/[source]/route.ts  - Trigger/status for specific source

src/app/(admin)/admin/
  data-sources/page.tsx         - Admin UI: source management
  data-sources/loading.tsx      - Loading skeleton

vercel.json                     - Cron schedule configuration
```

## Vercel Cron Configuration

```json
{
  "crons": [
    { "path": "/api/cron/sync?tier=1", "schedule": "0 */6 * * *" },
    { "path": "/api/cron/sync?tier=2", "schedule": "0 */12 * * *" },
    { "path": "/api/cron/sync?tier=3", "schedule": "0 8 * * *" },
    { "path": "/api/cron/sync?tier=4", "schedule": "0 0 * * 1" }
  ]
}
```

## Environment Variables (additions to .env.local.example)

```
# Data Sources (existing)
HUGGINGFACE_API_TOKEN=hf_...
ARTIFICIAL_ANALYSIS_API_KEY=

# Data Sources (new)
OPENAI_API_KEY=sk-...
REPLICATE_API_TOKEN=r8_...
GOOGLE_AI_API_KEY=
CIVITAI_API_KEY=

# Cron Security
CRON_SECRET=random-secret-for-vercel-cron
```

## Design Principles

1. **Config-driven**: Sources registered in DB; admin UI to enable/disable/configure
2. **Graceful degradation**: Each source fails independently; one failure never blocks others
3. **Retry with exponential backoff**: Up to 3 retries with 1s/2s/4s delays
4. **Per-source rate limiting**: Configurable delays in adapter config
5. **Incremental sync**: Use lastSyncAt to avoid re-fetching unchanged data
6. **Idempotent upserts**: ON CONFLICT DO UPDATE; safe to re-run at any time
7. **Observable**: sync_jobs tracks every run (timing, counts, errors, metadata)
8. **Secret management**: Keys in env vars, referenced by name in data_sources.secret_env_keys
9. **Timeout protection**: AbortSignal with per-adapter configurable timeout
10. **Batch processing**: Upsert in configurable batch sizes to avoid memory spikes

## Admin UI

New `/admin/data-sources` page:
- Table of all configured sources with status indicators
- Enable/disable toggles (immediate effect)
- Last sync time + status badge (success/partial/failed)
- Record count from last sync
- "Sync Now" button per source
- Error message display for failed syncs
- Health check ping button
- Navigation from admin sidebar
