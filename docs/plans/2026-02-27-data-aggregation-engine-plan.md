# Data Aggregation Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a production-grade, config-driven data pipeline that ingests AI model data from 12 sources across 4 tiers.

**Architecture:** Plugin registry pattern with Next.js API routes as sync engine, Vercel Cron scheduling, and a `data_sources` DB table for config-driven control. Each adapter implements a standard interface and fails independently.

**Tech Stack:** Next.js 16.1.6, TypeScript, Supabase PostgreSQL, Vercel Cron Jobs

---

## Critical Project Conventions

These patterns are used throughout the codebase — follow them exactly:

1. **Supabase casting:** API routes use `const sb = supabase as any;` to avoid `never` type errors. Always include the `eslint-disable` comment.
2. **Service-role client for API routes without auth:** `createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)` from `@supabase/supabase-js`.
3. **Authenticated API routes:** Use `createClient()` from `@/lib/supabase/server` (cookie-based), then `supabase.auth.getUser()`.
4. **Admin verification pattern:** Fetch profile, check `profile?.is_admin`. Return 403 if not.
5. **Rate limiting:** Import `rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders` from `@/lib/rate-limit`.
6. **API route boilerplate:** `export const dynamic = "force-dynamic";` at top.
7. **Admin pages:** `"use client"`, use `createClient` from `@/lib/supabase/client`, cast as `(supabase as any)`.
8. **Loading skeletons:** Use `animate-pulse rounded bg-secondary` divs.
9. **Database types:** Add all new types to `src/types/database.ts`.
10. **Migrations:** Apply via Supabase MCP `apply_migration` tool.

---

## Phase 36: Core Infrastructure

### Task 36.1: Create data-source type definitions

**Files:**
- Create: `src/lib/data-sources/types.ts`

**Step 1: Write the types file**

```typescript
// src/lib/data-sources/types.ts

/**
 * Data Source Aggregation Engine — Type Definitions
 *
 * Every adapter implements DataSourceAdapter.
 * The orchestrator reads data_sources table config, resolves secrets from env,
 * and calls adapter.sync() with a SyncContext.
 */

export type SyncOutputType =
  | "models"
  | "benchmarks"
  | "pricing"
  | "elo_ratings"
  | "news"
  | "rankings";

export type SyncStatus = "success" | "partial" | "failed";

/** Config stored in data_sources.config JSONB column */
export interface DataSourceRecord {
  id: number;
  slug: string;
  name: string;
  adapter_type: string;
  description: string | null;
  is_enabled: boolean;
  tier: number;
  sync_interval_hours: number;
  priority: number;
  config: Record<string, unknown>;
  secret_env_keys: string[];
  output_types: SyncOutputType[];
  last_sync_at: string | null;
  last_sync_status: SyncStatus | null;
  last_sync_records: number;
  last_error_message: string | null;
  created_at: string;
  updated_at: string;
}

/** Passed to every adapter.sync() call */
export interface SyncContext {
  /** Service-role Supabase client — full DB access */
  supabase: unknown; // SupabaseClient, typed as unknown to avoid import issues
  /** Adapter-specific config from data_sources.config JSONB */
  config: Record<string, unknown>;
  /** Resolved env var values keyed by the var name */
  secrets: Record<string, string>;
  /** ISO timestamp of last successful sync, or null if first run */
  lastSyncAt: string | null;
  /** AbortSignal for timeout control */
  signal?: AbortSignal;
}

export interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  errors: SyncError[];
  /** Cursor for chunked syncs — store in sync_jobs.metadata */
  cursor?: string;
  /** Arbitrary metadata to store in sync_jobs */
  metadata?: Record<string, unknown>;
}

export interface SyncError {
  message: string;
  context?: string;
}

export interface HealthCheckResult {
  healthy: boolean;
  latencyMs: number;
  message?: string;
}

/** Every adapter implements this interface */
export interface DataSourceAdapter {
  /** Unique adapter identifier — must match data_sources.adapter_type */
  id: string;
  /** Human-readable name */
  name: string;
  /** What tables this adapter writes to */
  outputTypes: SyncOutputType[];
  /** Default config values (merged with DB config) */
  defaultConfig: Record<string, unknown>;
  /** Required env var names */
  requiredSecrets: string[];

  /**
   * Fetch data from the external source and upsert into Supabase.
   * Must be idempotent — safe to call repeatedly.
   */
  sync(ctx: SyncContext): Promise<SyncResult>;

  /**
   * Quick health check — can the source be reached?
   * Should complete in < 5 seconds.
   */
  healthCheck(secrets: Record<string, string>): Promise<HealthCheckResult>;
}
```

**Step 2: Commit**

```bash
git add src/lib/data-sources/types.ts
git commit -m "feat(data-sources): add adapter type definitions"
```

---

### Task 36.2: Create shared utility functions

**Files:**
- Create: `src/lib/data-sources/utils.ts`

**Step 1: Write the utils file**

```typescript
// src/lib/data-sources/utils.ts

/**
 * Shared utilities for data source adapters:
 * - fetchWithRetry: fetch with exponential backoff
 * - rateLimitedFetch: fetch with delay between calls
 * - upsertBatch: batch upsert into Supabase via REST
 * - makeSlug: generate URL-safe slugs
 * - resolveSecrets: resolve env var names to values
 */

import type { SyncError } from "./types";

// --------------- Retry & Fetch ---------------

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  signal?: AbortSignal;
}

/**
 * Fetch with exponential backoff retry.
 * Retries on 429, 500, 502, 503, 504 status codes.
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options?: RetryOptions
): Promise<Response> {
  const { maxRetries = 3, baseDelayMs = 1000, signal } = options ?? {};

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal });

      // Don't retry client errors (except 429)
      if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) {
        return res;
      }

      // Retry on server errors and rate limits
      if (attempt < maxRetries) {
        const retryAfter = res.headers.get("retry-after");
        const delayMs = retryAfter
          ? parseInt(retryAfter) * 1000
          : baseDelayMs * Math.pow(2, attempt);
        await sleep(delayMs);
        continue;
      }

      return res; // Return last failed response
    } catch (err) {
      if (signal?.aborted) throw err;
      if (attempt >= maxRetries) throw err;
      await sleep(baseDelayMs * Math.pow(2, attempt));
    }
  }

  throw new Error("fetchWithRetry: exhausted retries");
}

/**
 * Fetch with a minimum delay between calls (rate limiting).
 */
export function createRateLimitedFetch(delayMs: number) {
  let lastCall = 0;

  return async (url: string, init?: RequestInit, signal?: AbortSignal): Promise<Response> => {
    const now = Date.now();
    const elapsed = now - lastCall;
    if (elapsed < delayMs) {
      await sleep(delayMs - elapsed);
    }
    lastCall = Date.now();
    return fetchWithRetry(url, { ...init, signal }, { signal });
  };
}

// --------------- Supabase Helpers ---------------

/**
 * Batch upsert records into a Supabase table using the REST API.
 * Uses service-role key for full access. Handles conflicts via ON CONFLICT.
 */
export async function upsertBatch(
  supabase: unknown,
  table: string,
  records: Record<string, unknown>[],
  conflictColumn: string,
  batchSize = 100
): Promise<{ created: number; errors: SyncError[] }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  let totalCreated = 0;
  const errors: SyncError[] = [];

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    const { error, count } = await sb
      .from(table)
      .upsert(batch, { onConflict: conflictColumn, count: "exact" });

    if (error) {
      errors.push({
        message: `Upsert batch ${i / batchSize + 1} failed: ${error.message}`,
        context: `table=${table}, batchStart=${i}, batchSize=${batch.length}`,
      });
    } else {
      totalCreated += count ?? batch.length;
    }
  }

  return { created: totalCreated, errors };
}

// --------------- String Helpers ---------------

/** Generate a URL-safe slug from any string */
export function makeSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/\//g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// --------------- Env / Secrets ---------------

/** Resolve env var names to their values. Skips missing vars. */
export function resolveSecrets(envKeys: string[]): Record<string, string> {
  const secrets: Record<string, string> = {};
  for (const key of envKeys) {
    const value = process.env[key];
    if (value) {
      secrets[key] = value;
    }
  }
  return secrets;
}

// --------------- Time Helpers ---------------

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Check if a source needs syncing based on last_sync_at and interval */
export function needsSync(
  lastSyncAt: string | null,
  intervalHours: number
): boolean {
  if (!lastSyncAt) return true;
  const lastSync = new Date(lastSyncAt).getTime();
  const now = Date.now();
  const intervalMs = intervalHours * 60 * 60 * 1000;
  return now - lastSync >= intervalMs;
}
```

**Step 2: Commit**

```bash
git add src/lib/data-sources/utils.ts
git commit -m "feat(data-sources): add shared utilities (retry, batch upsert, slug)"
```

---

### Task 36.3: Create adapter registry

**Files:**
- Create: `src/lib/data-sources/registry.ts`

**Step 1: Write the registry**

```typescript
// src/lib/data-sources/registry.ts

/**
 * Adapter Registry — factory pattern.
 * Adapters register themselves on import.
 * The orchestrator looks up adapters by adapter_type string.
 */

import type { DataSourceAdapter } from "./types";

const adapters = new Map<string, DataSourceAdapter>();

/** Register an adapter. Called once per adapter module. */
export function registerAdapter(adapter: DataSourceAdapter): void {
  if (adapters.has(adapter.id)) {
    console.warn(`Adapter "${adapter.id}" is already registered, overwriting.`);
  }
  adapters.set(adapter.id, adapter);
}

/** Get an adapter by its ID (matches data_sources.adapter_type). */
export function getAdapter(id: string): DataSourceAdapter | undefined {
  return adapters.get(id);
}

/** List all registered adapter IDs. */
export function listAdapters(): string[] {
  return Array.from(adapters.keys());
}

/**
 * Import and register all adapters.
 * Call once at orchestrator startup.
 * Uses dynamic imports so unused adapters don't bloat bundles.
 */
export async function loadAllAdapters(): Promise<void> {
  await Promise.all([
    import("./adapters/huggingface"),
    import("./adapters/replicate"),
    import("./adapters/openai-models"),
    import("./adapters/anthropic-models"),
    import("./adapters/google-models"),
    import("./adapters/artificial-analysis"),
    import("./adapters/open-llm-leaderboard"),
    import("./adapters/chatbot-arena"),
    import("./adapters/arxiv"),
    import("./adapters/hf-papers"),
    import("./adapters/github-trending"),
    import("./adapters/civitai"),
  ]);
}
```

**Step 2: Commit**

```bash
git add src/lib/data-sources/registry.ts
git commit -m "feat(data-sources): add adapter registry with lazy loading"
```

---

### Task 36.4: Create the orchestrator

**Files:**
- Create: `src/lib/data-sources/orchestrator.ts`

**Step 1: Write the orchestrator**

```typescript
// src/lib/data-sources/orchestrator.ts

/**
 * Sync Orchestrator
 *
 * Reads enabled data_sources for a given tier,
 * runs each adapter sequentially (to avoid memory pressure),
 * records results into sync_jobs table.
 */

import { createClient } from "@supabase/supabase-js";
import type { DataSourceRecord, SyncContext, SyncResult, SyncError } from "./types";
import { getAdapter, loadAllAdapters } from "./registry";
import { resolveSecrets, needsSync } from "./utils";

interface OrchestratorResult {
  tier: number;
  sourcesRun: number;
  sourcesSucceeded: number;
  sourcesFailed: number;
  details: {
    source: string;
    status: "success" | "partial" | "failed" | "skipped";
    recordsProcessed: number;
    errors: SyncError[];
    durationMs: number;
  }[];
}

/** Run all enabled sources for a given tier */
export async function runTierSync(tier: number): Promise<OrchestratorResult> {
  // Ensure all adapters are loaded
  await loadAllAdapters();

  // Create service-role client (bypasses RLS)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Fetch enabled sources for this tier, ordered by priority
  const { data: sources, error: fetchErr } = await sb
    .from("data_sources")
    .select("*")
    .eq("is_enabled", true)
    .eq("tier", tier)
    .order("priority", { ascending: true });

  if (fetchErr) {
    throw new Error(`Failed to fetch data_sources: ${fetchErr.message}`);
  }

  const result: OrchestratorResult = {
    tier,
    sourcesRun: 0,
    sourcesSucceeded: 0,
    sourcesFailed: 0,
    details: [],
  };

  for (const source of (sources ?? []) as DataSourceRecord[]) {
    const adapter = getAdapter(source.adapter_type);

    if (!adapter) {
      result.details.push({
        source: source.slug,
        status: "failed",
        recordsProcessed: 0,
        errors: [{ message: `No adapter registered for type "${source.adapter_type}"` }],
        durationMs: 0,
      });
      result.sourcesFailed++;
      continue;
    }

    // Check if sync is due
    if (!needsSync(source.last_sync_at, source.sync_interval_hours)) {
      result.details.push({
        source: source.slug,
        status: "skipped",
        recordsProcessed: 0,
        errors: [],
        durationMs: 0,
      });
      continue;
    }

    result.sourcesRun++;
    const startTime = Date.now();

    // Resolve secrets from env
    const secrets = resolveSecrets(source.secret_env_keys);

    // Merge default config with DB config
    const config = { ...adapter.defaultConfig, ...source.config };

    // Create abort controller with 5-minute timeout per adapter
    const timeoutMs = (config.timeoutSeconds as number ?? 300) * 1000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    // Create sync context
    const ctx: SyncContext = {
      supabase: sb,
      config,
      secrets,
      lastSyncAt: source.last_sync_at,
      signal: controller.signal,
    };

    // Create sync_jobs record
    const { data: syncJob } = await sb.from("sync_jobs").insert({
      source: source.slug,
      job_type: "scheduled",
      status: "running",
      started_at: new Date().toISOString(),
      metadata: { tier, adapter_type: source.adapter_type },
    }).select("id").single();

    let syncResult: SyncResult;

    try {
      syncResult = await adapter.sync(ctx);
    } catch (err) {
      syncResult = {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ message: err instanceof Error ? err.message : String(err) }],
      };
    } finally {
      clearTimeout(timeout);
    }

    const durationMs = Date.now() - startTime;
    const status = syncResult.success
      ? "success"
      : syncResult.errors.length > 0 && syncResult.recordsProcessed > 0
        ? "partial"
        : "failed";

    // Update sync_jobs record
    if (syncJob?.id) {
      await sb.from("sync_jobs").update({
        status: status === "success" ? "completed" : "failed",
        completed_at: new Date().toISOString(),
        records_processed: syncResult.recordsProcessed,
        records_created: syncResult.recordsCreated,
        records_updated: syncResult.recordsUpdated,
        error_message: syncResult.errors.length > 0
          ? syncResult.errors.map((e) => e.message).join("; ")
          : null,
        metadata: {
          tier,
          adapter_type: source.adapter_type,
          duration_ms: durationMs,
          cursor: syncResult.cursor,
          ...syncResult.metadata,
        },
      }).eq("id", syncJob.id);
    }

    // Update data_sources record
    await sb.from("data_sources").update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: status,
      last_sync_records: syncResult.recordsProcessed,
      last_error_message: syncResult.errors.length > 0
        ? syncResult.errors[0].message
        : null,
      updated_at: new Date().toISOString(),
    }).eq("id", source.id);

    if (status === "failed") {
      result.sourcesFailed++;
    } else {
      result.sourcesSucceeded++;
    }

    result.details.push({
      source: source.slug,
      status,
      recordsProcessed: syncResult.recordsProcessed,
      errors: syncResult.errors,
      durationMs,
    });
  }

  return result;
}

/** Run a single source by slug (for manual triggers) */
export async function runSingleSync(slug: string): Promise<OrchestratorResult> {
  await loadAllAdapters();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: source, error } = await sb
    .from("data_sources")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !source) {
    throw new Error(`Data source "${slug}" not found`);
  }

  // Override tier to run just this source
  const record = source as DataSourceRecord;
  const adapter = getAdapter(record.adapter_type);

  if (!adapter) {
    throw new Error(`No adapter registered for type "${record.adapter_type}"`);
  }

  const startTime = Date.now();
  const secrets = resolveSecrets(record.secret_env_keys);
  const config = { ...adapter.defaultConfig, ...record.config };
  const timeoutMs = (config.timeoutSeconds as number ?? 300) * 1000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const ctx: SyncContext = {
    supabase: sb,
    config,
    secrets,
    lastSyncAt: record.last_sync_at,
    signal: controller.signal,
  };

  const { data: syncJob } = await sb.from("sync_jobs").insert({
    source: record.slug,
    job_type: "manual",
    status: "running",
    started_at: new Date().toISOString(),
    metadata: { adapter_type: record.adapter_type, trigger: "manual" },
  }).select("id").single();

  let syncResult: SyncResult;
  try {
    syncResult = await adapter.sync(ctx);
  } catch (err) {
    syncResult = {
      success: false,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      errors: [{ message: err instanceof Error ? err.message : String(err) }],
    };
  } finally {
    clearTimeout(timeout);
  }

  const durationMs = Date.now() - startTime;
  const status = syncResult.success ? "success" : syncResult.recordsProcessed > 0 ? "partial" : "failed";

  if (syncJob?.id) {
    await sb.from("sync_jobs").update({
      status: status === "success" ? "completed" : "failed",
      completed_at: new Date().toISOString(),
      records_processed: syncResult.recordsProcessed,
      records_created: syncResult.recordsCreated,
      records_updated: syncResult.recordsUpdated,
      error_message: syncResult.errors.length > 0 ? syncResult.errors.map((e) => e.message).join("; ") : null,
      metadata: { adapter_type: record.adapter_type, trigger: "manual", duration_ms: durationMs },
    }).eq("id", syncJob.id);
  }

  await sb.from("data_sources").update({
    last_sync_at: new Date().toISOString(),
    last_sync_status: status,
    last_sync_records: syncResult.recordsProcessed,
    last_error_message: syncResult.errors.length > 0 ? syncResult.errors[0].message : null,
    updated_at: new Date().toISOString(),
  }).eq("id", record.id);

  return {
    tier: record.tier,
    sourcesRun: 1,
    sourcesSucceeded: status !== "failed" ? 1 : 0,
    sourcesFailed: status === "failed" ? 1 : 0,
    details: [{
      source: record.slug,
      status,
      recordsProcessed: syncResult.recordsProcessed,
      errors: syncResult.errors,
      durationMs,
    }],
  };
}
```

**Step 2: Commit**

```bash
git add src/lib/data-sources/orchestrator.ts
git commit -m "feat(data-sources): add sync orchestrator with tier-based scheduling"
```

---

### Task 36.5: Database migration — data_sources + model_news tables

**Migration via Supabase MCP tool.** Use `apply_migration` with project_id `lvqdzpnvkyknlsminaak`.

**SQL:**

```sql
-- data_sources: config-driven registry of all sync sources
CREATE TABLE IF NOT EXISTS data_sources (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  adapter_type TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT true,
  tier INTEGER DEFAULT 1 CHECK (tier BETWEEN 1 AND 4),
  sync_interval_hours INTEGER DEFAULT 6 CHECK (sync_interval_hours > 0),
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

-- model_news: papers, announcements, releases
CREATE TABLE IF NOT EXISTS model_news (
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_data_sources_tier_enabled ON data_sources(tier, is_enabled);
CREATE INDEX IF NOT EXISTS idx_data_sources_adapter ON data_sources(adapter_type);
CREATE INDEX IF NOT EXISTS idx_model_news_source ON model_news(source, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_news_published ON model_news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_news_provider ON model_news(related_provider);

-- RLS policies
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_news ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage data_sources"
  ON data_sources FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Public can read data_sources"
  ON data_sources FOR SELECT
  USING (true);

CREATE POLICY "Public can read model_news"
  ON model_news FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage model_news"
  ON model_news FOR ALL
  USING (true);

-- Update trigger for data_sources
CREATE TRIGGER update_data_sources_updated_at
  BEFORE UPDATE ON data_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed the 12 data sources
INSERT INTO data_sources (slug, name, adapter_type, description, tier, sync_interval_hours, priority, secret_env_keys, output_types, config) VALUES
  ('huggingface', 'Hugging Face Hub', 'huggingface', 'Trending models from HuggingFace Hub API', 1, 6, 10, '{"HUGGINGFACE_API_TOKEN"}', '{"models"}', '{"maxPages": 50, "pageSize": 100, "rateLimitDelayMs": 200}'),
  ('replicate', 'Replicate', 'replicate', 'Hosted model catalog from Replicate API', 1, 6, 20, '{"REPLICATE_API_TOKEN"}', '{"models"}', '{"maxPages": 10}'),
  ('openai-models', 'OpenAI Models', 'openai-models', 'OpenAI model catalog via /v1/models', 1, 6, 30, '{"OPENAI_API_KEY"}', '{"models"}', '{}'),
  ('anthropic-models', 'Anthropic Models', 'anthropic-models', 'Claude model family catalog', 1, 6, 40, '{}', '{"models"}', '{}'),
  ('google-models', 'Google AI Models', 'google-models', 'Gemini model family via Generative AI API', 1, 6, 50, '{"GOOGLE_AI_API_KEY"}', '{"models"}', '{}'),
  ('artificial-analysis', 'Artificial Analysis', 'artificial-analysis', 'Benchmark scores and token pricing data', 2, 12, 10, '{"ARTIFICIAL_ANALYSIS_API_KEY"}', '{"benchmarks","pricing"}', '{}'),
  ('open-llm-leaderboard', 'Open LLM Leaderboard', 'open-llm-leaderboard', 'HuggingFace Open LLM Leaderboard benchmark scores', 2, 12, 20, '{}', '{"benchmarks"}', '{}'),
  ('chatbot-arena', 'Chatbot Arena', 'chatbot-arena', 'LMSYS Chatbot Arena Elo ratings', 2, 12, 30, '{}', '{"elo_ratings"}', '{}'),
  ('arxiv', 'arXiv Papers', 'arxiv', 'New ML research papers from arXiv (cs.CL, cs.AI, cs.LG)', 3, 24, 10, '{}', '{"news"}', '{"categories": ["cs.CL", "cs.AI", "cs.LG"], "maxResults": 100}'),
  ('hf-papers', 'HF Daily Papers', 'hf-papers', 'Trending papers from HuggingFace', 3, 24, 20, '{}', '{"news"}', '{}'),
  ('github-trending', 'GitHub Trending', 'github-trending', 'Trending ML repositories on GitHub', 4, 168, 10, '{}', '{"models"}', '{"language": "python", "topic": "machine-learning"}'),
  ('civitai', 'Civitai', 'civitai', 'Community diffusion model hub', 4, 168, 20, '{"CIVITAI_API_KEY"}', '{"models"}', '{"limit": 100, "sort": "Newest"}')
ON CONFLICT (slug) DO NOTHING;
```

After migration, update `src/types/database.ts` to add the new interfaces and table definitions:

- Add `DataSource` interface matching all columns
- Add `ModelNews` interface matching all columns
- Add both to `Database.public.Tables`

**Step 2: Commit**

```bash
git add src/types/database.ts
git commit -m "feat(data-sources): add data_sources + model_news migration and types"
```

---

### Task 36.6: Create the Vercel Cron endpoint

**Files:**
- Create: `src/app/api/cron/sync/route.ts`

**Step 1: Write the cron route**

```typescript
// src/app/api/cron/sync/route.ts

import { NextRequest, NextResponse } from "next/server";
import { runTierSync } from "@/lib/data-sources/orchestrator";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max (Vercel Pro)

/**
 * Vercel Cron endpoint for data source sync.
 * Protected by CRON_SECRET header.
 *
 * Usage: GET /api/cron/sync?tier=1
 * Called by Vercel Cron (configured in vercel.json)
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this automatically)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tier = parseInt(searchParams.get("tier") || "0");

  if (tier < 1 || tier > 4) {
    return NextResponse.json(
      { error: "Invalid tier. Must be 1-4." },
      { status: 400 }
    );
  }

  try {
    const result = await runTierSync(tier);

    return NextResponse.json({
      ok: true,
      tier: result.tier,
      sourcesRun: result.sourcesRun,
      sourcesSucceeded: result.sourcesSucceeded,
      sourcesFailed: result.sourcesFailed,
      details: result.details.map((d) => ({
        source: d.source,
        status: d.status,
        records: d.recordsProcessed,
        durationMs: d.durationMs,
        errors: d.errors.length,
      })),
    });
  } catch (err) {
    console.error("Cron sync failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/cron/sync/route.ts
git commit -m "feat(data-sources): add Vercel Cron sync endpoint"
```

---

### Task 36.7: Create admin sync API routes

**Files:**
- Create: `src/app/api/admin/data-sources/route.ts`
- Create: `src/app/api/admin/sync/route.ts`
- Create: `src/app/api/admin/sync/[source]/route.ts`

**Step 1: Write admin data-sources CRUD**

```typescript
// src/app/api/admin/data-sources/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET /api/admin/data-sources — list all data sources
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(`admin-ds:${ip}`, RATE_LIMITS.public);
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: profile } = await sb.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await sb
    .from("data_sources")
    .select("*")
    .order("tier", { ascending: true })
    .order("priority", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// PATCH /api/admin/data-sources — toggle enable/disable
export async function PATCH(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(`admin-ds-write:${ip}`, RATE_LIMITS.write);
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: profile } = await sb.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { id, is_enabled } = body;

  if (!id || typeof is_enabled !== "boolean") {
    return NextResponse.json({ error: "Missing id or is_enabled" }, { status: 400 });
  }

  const { error } = await sb
    .from("data_sources")
    .update({ is_enabled, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
```

**Step 2: Write admin sync status + manual trigger**

```typescript
// src/app/api/admin/sync/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET /api/admin/sync — recent sync jobs
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(`admin-sync:${ip}`, RATE_LIMITS.public);
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: profile } = await sb.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await sb
    .from("sync_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
```

**Step 3: Write per-source manual trigger**

```typescript
// src/app/api/admin/sync/[source]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { runSingleSync } from "@/lib/data-sources/orchestrator";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/admin/sync/[source] — manually trigger sync for one source
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ source: string }> }
) {
  const { source } = await params;

  const ip = getClientIp(request);
  const rl = rateLimit(`admin-sync-trigger:${ip}`, RATE_LIMITS.write);
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: profile } = await sb.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const result = await runSingleSync(source);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
```

**Step 4: Commit**

```bash
git add src/app/api/admin/data-sources/route.ts src/app/api/admin/sync/route.ts src/app/api/admin/sync/\[source\]/route.ts
git commit -m "feat(data-sources): add admin API routes for data source management and sync"
```

---

### Task 36.8: Create vercel.json cron config

**Files:**
- Create: `vercel.json`

**Step 1: Write vercel.json**

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

**Step 2: Update `.env.local.example`** — add the new env vars at the bottom of the Data Sources section:

```
# Data Sources (new)
OPENAI_API_KEY=sk-...
REPLICATE_API_TOKEN=r8_...
GOOGLE_AI_API_KEY=
CIVITAI_API_KEY=

# Cron Security
CRON_SECRET=random-secret-for-vercel-cron
```

**Step 3: Commit**

```bash
git add vercel.json .env.local.example
git commit -m "feat(data-sources): add Vercel cron config and new env var placeholders"
```

---

### Task 36.9: Create placeholder adapter stubs (all 12)

**Files:**
- Create: `src/lib/data-sources/adapters/huggingface.ts` (and 11 more)

For each adapter, create a minimal stub that registers itself and has a no-op sync:

```typescript
// Template for each adapter stub
import type { DataSourceAdapter, SyncContext, SyncResult, HealthCheckResult } from "../types";
import { registerAdapter } from "../registry";

const adapter: DataSourceAdapter = {
  id: "ADAPTER_ID",
  name: "ADAPTER_NAME",
  outputTypes: ["models"], // varies per adapter
  defaultConfig: {},
  requiredSecrets: [],

  async sync(_ctx: SyncContext): Promise<SyncResult> {
    // TODO: implement in Phase 37/38/39/40
    return {
      success: true,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      errors: [],
      metadata: { stub: true },
    };
  },

  async healthCheck(): Promise<HealthCheckResult> {
    return { healthy: true, latencyMs: 0, message: "Stub — not implemented yet" };
  },
};

registerAdapter(adapter);
export default adapter;
```

Create all 12 files using this template with the correct id, name, outputTypes, and requiredSecrets per the design doc.

| File | id | outputTypes | requiredSecrets |
|------|----|-------------|-----------------|
| `huggingface.ts` | `huggingface` | `["models"]` | `["HUGGINGFACE_API_TOKEN"]` |
| `replicate.ts` | `replicate` | `["models"]` | `["REPLICATE_API_TOKEN"]` |
| `openai-models.ts` | `openai-models` | `["models"]` | `["OPENAI_API_KEY"]` |
| `anthropic-models.ts` | `anthropic-models` | `["models"]` | `[]` |
| `google-models.ts` | `google-models` | `["models"]` | `["GOOGLE_AI_API_KEY"]` |
| `artificial-analysis.ts` | `artificial-analysis` | `["benchmarks", "pricing"]` | `["ARTIFICIAL_ANALYSIS_API_KEY"]` |
| `open-llm-leaderboard.ts` | `open-llm-leaderboard` | `["benchmarks"]` | `[]` |
| `chatbot-arena.ts` | `chatbot-arena` | `["elo_ratings"]` | `[]` |
| `arxiv.ts` | `arxiv` | `["news"]` | `[]` |
| `hf-papers.ts` | `hf-papers` | `["news"]` | `[]` |
| `github-trending.ts` | `github-trending` | `["models"]` | `[]` |
| `civitai.ts` | `civitai` | `["models"]` | `["CIVITAI_API_KEY"]` |

**Step 2: Commit**

```bash
git add src/lib/data-sources/adapters/
git commit -m "feat(data-sources): add 12 adapter stubs with registry registration"
```

---

### Task 36.10: Build verification

Run `next build` to confirm all new files compile. Fix any import/type errors.

**Expected:** Build passes with 0 errors. All 12 adapters register as stubs.

**Step 1: Commit** (if any fixes were needed)

```bash
git add -A
git commit -m "fix: resolve build errors in data-sources infrastructure"
```

---

## Phase 37: Tier 1 — Model Hub Adapters

### Task 37.1: Implement HuggingFace adapter

**Files:**
- Modify: `src/lib/data-sources/adapters/huggingface.ts`

Port the logic from `supabase/functions/sync-huggingface/index.ts` into the adapter interface. Reuse the same `mapCategory`, `mapLicense`, `extractParamCount`, and `transformModel` functions but adapted from Deno to Node.

Key changes from the Edge Function:
- Use `fetchWithRetry` and `createRateLimitedFetch` from utils
- Read `maxPages`, `pageSize`, `rateLimitDelayMs` from `ctx.config`
- Use `upsertBatch(ctx.supabase, "models", records, "slug")` instead of raw REST
- Return proper `SyncResult` with error tracking
- Use `ctx.secrets.HUGGINGFACE_API_TOKEN` for auth header
- Support cursor-based chunking: read cursor from `ctx.config.cursor`, return new cursor in result

**Implementation notes:**
- HF API: `GET https://huggingface.co/api/models?limit=100&offset=N&sort=trendingScore&direction=-1&full=true`
- Auth: `Authorization: Bearer ${token}` (optional but increases rate limit)
- Filter: skip `private` and `disabled` models
- Transform: map pipeline_tag→category, extract param count from tags, detect license type

**Step 2: Commit**

```bash
git add src/lib/data-sources/adapters/huggingface.ts
git commit -m "feat(adapters): implement HuggingFace Hub adapter"
```

---

### Task 37.2: Implement Replicate adapter

**Files:**
- Modify: `src/lib/data-sources/adapters/replicate.ts`

**API:** `GET https://api.replicate.com/v1/models` (paginated, requires `REPLICATE_API_TOKEN`)

- Auth: `Authorization: Bearer ${token}`
- Response: `{ results: [...], next: "cursor_url" }`
- Each model has: `url`, `owner`, `name`, `description`, `visibility`, `run_count`, `cover_image_url`, `default_example`, `latest_version`
- Map to our schema: slug = `owner-name`, provider = `owner`, category = infer from description/tags
- Upsert with `is_api_available: true` since Replicate hosts runnable models
- Use `replicate_model_id` field or store in `hf_model_id` with prefix
- Store `run_count` as `hf_downloads` for comparability (or add a new field)

**Step 2: Commit**

```bash
git add src/lib/data-sources/adapters/replicate.ts
git commit -m "feat(adapters): implement Replicate model catalog adapter"
```

---

### Task 37.3: Implement OpenAI Models adapter

**Files:**
- Modify: `src/lib/data-sources/adapters/openai-models.ts`

**API:** `GET https://api.openai.com/v1/models`
- Auth: `Authorization: Bearer ${OPENAI_API_KEY}`
- Response: `{ data: [{ id, object, created, owned_by }] }`
- Filter: only models owned by `openai` or `system` (skip fine-tuned)
- Map known models to categories (gpt-* → llm, dall-e-* → image_generation, whisper-* → speech_audio, text-embedding-* → embeddings, tts-* → speech_audio)
- Maintain a static mapping of known model metadata (parameter counts, context windows) since the API only returns minimal info
- Upsert with `is_api_available: true`, provider = "OpenAI"

**Step 2: Commit**

```bash
git add src/lib/data-sources/adapters/openai-models.ts
git commit -m "feat(adapters): implement OpenAI Models adapter"
```

---

### Task 37.4: Implement Anthropic Models adapter

**Files:**
- Modify: `src/lib/data-sources/adapters/anthropic-models.ts`

This is a **static catalog adapter** — Anthropic doesn't have a public model listing API.

- Maintain a hardcoded catalog of Claude models with known metadata (Claude 4 Opus, Claude 4 Sonnet, Claude 3.5 Haiku, etc.)
- Include: parameter_count (estimated), context_window, release_date, pricing info, capabilities
- On each sync, upsert the catalog — ensures new models are picked up when we update the adapter code
- Set `is_api_available: true`, provider = "Anthropic", license = "commercial"
- Health check always returns healthy (no external API call)

**Step 2: Commit**

```bash
git add src/lib/data-sources/adapters/anthropic-models.ts
git commit -m "feat(adapters): implement Anthropic Models static catalog adapter"
```

---

### Task 37.5: Implement Google AI Models adapter

**Files:**
- Modify: `src/lib/data-sources/adapters/google-models.ts`

**API:** `GET https://generativelanguage.googleapis.com/v1beta/models?key=${GOOGLE_AI_API_KEY}`
- Response: `{ models: [{ name, version, displayName, description, inputTokenLimit, outputTokenLimit, supportedGenerationMethods, temperature, topP, topK }] }`
- Map to our schema: extract model name from `name` field (format: "models/gemini-1.5-flash"), set provider = "Google"
- Categorize: gemini-* → llm (or multimodal if vision supported), embedding-* → embeddings
- Set context_window from `inputTokenLimit`
- Set `is_api_available: true`, license = "commercial"

**Fallback:** If no API key, use a static catalog similar to Anthropic adapter.

**Step 2: Commit**

```bash
git add src/lib/data-sources/adapters/google-models.ts
git commit -m "feat(adapters): implement Google AI Models adapter"
```

---

### Task 37.6: Build verification + integration commit

Run `next build`. Verify all 5 Tier 1 adapters compile and register.

```bash
git add -A
git commit -m "feat: complete Phase 37 — Tier 1 model hub adapters (HF, Replicate, OpenAI, Anthropic, Google)"
```

---

## Phase 38: Tier 2 — Benchmark & Pricing Adapters

### Task 38.1: Implement Artificial Analysis adapter

**Files:**
- Modify: `src/lib/data-sources/adapters/artificial-analysis.ts`

**API:** `GET https://api.artificialanalysis.ai/v1/models` (or similar — check docs)
- Auth: `Authorization: Bearer ${ARTIFICIAL_ANALYSIS_API_KEY}`
- Returns: model performance metrics, pricing data, throughput benchmarks
- Map benchmark scores to existing `benchmark_scores` table: match models by name/slug
- Map pricing data to `model_pricing` table: input/output token prices, throughput
- Use `upsertBatch` for both benchmark_scores and model_pricing
- Match models by fuzzy name lookup if slug doesn't match directly

**Fallback:** If the API format is undocumented, scrape their public leaderboard data.

**Step 2: Commit**

```bash
git add src/lib/data-sources/adapters/artificial-analysis.ts
git commit -m "feat(adapters): implement Artificial Analysis benchmark + pricing adapter"
```

---

### Task 38.2: Implement Open LLM Leaderboard adapter

**Files:**
- Modify: `src/lib/data-sources/adapters/open-llm-leaderboard.ts`

**API:** HuggingFace Datasets API for the leaderboard dataset:
`GET https://huggingface.co/api/datasets/open-llm-leaderboard/results/parquet/default/train/0.parquet`

Or use the JSON endpoint:
`GET https://huggingface.co/api/datasets/open-llm-leaderboard-old/results`

- Parse leaderboard entries: model name, benchmark scores (MMLU, ARC, HellaSwag, TruthfulQA, etc.)
- Match models to our DB by name/slug fuzzy matching
- Upsert into `benchmark_scores` table, linking to existing benchmark IDs
- Handle: scores are percentages (0-100), normalize to our schema

**Step 2: Commit**

```bash
git add src/lib/data-sources/adapters/open-llm-leaderboard.ts
git commit -m "feat(adapters): implement Open LLM Leaderboard adapter"
```

---

### Task 38.3: Implement Chatbot Arena adapter

**Files:**
- Modify: `src/lib/data-sources/adapters/chatbot-arena.ts`

**API:** LMSYS Chatbot Arena leaderboard data is published on HuggingFace:
`GET https://huggingface.co/api/spaces/lmsys/chatbot-arena-leaderboard` or use the datasets API.

Alternative: scrape `https://lmarena.ai/leaderboard` or use their published dataset.

- Parse: model name, Elo score, confidence intervals, number of battles, rank
- Match models to our DB by name
- Upsert into `elo_ratings` table with `arena_name: "chatbot-arena"`
- Set `snapshot_date` to today

**Step 2: Commit**

```bash
git add src/lib/data-sources/adapters/chatbot-arena.ts
git commit -m "feat(adapters): implement Chatbot Arena Elo ratings adapter"
```

---

### Task 38.4: Build verification

Run `next build`. Verify all Tier 2 adapters compile.

```bash
git add -A
git commit -m "feat: complete Phase 38 — Tier 2 benchmark & pricing adapters"
```

---

## Phase 39: Tier 3 — News & Research Adapters

### Task 39.1: Implement arXiv adapter

**Files:**
- Modify: `src/lib/data-sources/adapters/arxiv.ts`

**API:** `GET http://export.arxiv.org/api/query?search_query=cat:cs.CL+OR+cat:cs.AI+OR+cat:cs.LG&sortBy=submittedDate&sortOrder=descending&max_results=100`

- Response: Atom XML feed
- Parse XML to extract: id (arxiv ID), title, summary, authors, published date, categories, links
- Insert into `model_news` table: source="arxiv", source_id=arxiv_id, url=abs link
- Use `lastSyncAt` to only fetch papers published since last sync
- Try to match papers to providers/models by checking title for known model names
- Set `related_provider` if title mentions known provider (OpenAI, Google, Meta, etc.)
- Parse XML without external library: use regex or DOMParser-compatible approach

**Step 2: Commit**

```bash
git add src/lib/data-sources/adapters/arxiv.ts
git commit -m "feat(adapters): implement arXiv paper feed adapter"
```

---

### Task 39.2: Implement HF Daily Papers adapter

**Files:**
- Modify: `src/lib/data-sources/adapters/hf-papers.ts`

**API:** `GET https://huggingface.co/api/daily_papers`
- Response: JSON array of papers with title, summary, authors, paper URL, upvotes
- Insert into `model_news` table: source="hf-papers", source_id=paper_id
- Set category based on content (paper, announcement, etc.)
- Match to providers by checking title/summary for known names

**Step 2: Commit**

```bash
git add src/lib/data-sources/adapters/hf-papers.ts
git commit -m "feat(adapters): implement HuggingFace Daily Papers adapter"
```

---

### Task 39.3: Build verification

```bash
git add -A
git commit -m "feat: complete Phase 39 — Tier 3 news & research adapters"
```

---

## Phase 40: Tier 4 — Community Adapters

### Task 40.1: Implement GitHub Trending adapter

**Files:**
- Modify: `src/lib/data-sources/adapters/github-trending.ts`

**API:** GitHub Search API:
`GET https://api.github.com/search/repositories?q=topic:machine-learning+language:python+created:>YYYY-MM-DD&sort=stars&order=desc&per_page=50`

- No auth required (but rate limited to 10 req/min without token)
- Extract: full_name, description, stargazers_count, topics, language, html_url, created_at
- Use to enrich existing models: if a model has a `github_url`, update its metadata
- For new repos, create model entries with category inferred from topics
- Store `stargazers_count` as a popularity signal

**Step 2: Commit**

```bash
git add src/lib/data-sources/adapters/github-trending.ts
git commit -m "feat(adapters): implement GitHub Trending ML repos adapter"
```

---

### Task 40.2: Implement Civitai adapter

**Files:**
- Modify: `src/lib/data-sources/adapters/civitai.ts`

**API:** `GET https://civitai.com/api/v1/models?limit=100&sort=Newest&types=Checkpoint,LORA`
- Auth: optional `Authorization: Bearer ${CIVITAI_API_KEY}` for higher rate limits
- Response: `{ items: [{ id, name, description, type, stats: { downloadCount, favoriteCount, commentCount, ratingCount, rating }, modelVersions, tags, creator }] }`
- Map to our schema: category = "image_generation", provider = creator.username
- Set `is_open_weights: true` (Civitai is community models)
- Use `upsertBatch` with slug conflict

**Step 2: Commit**

```bash
git add src/lib/data-sources/adapters/civitai.ts
git commit -m "feat(adapters): implement Civitai community models adapter"
```

---

### Task 40.3: Build verification

```bash
git add -A
git commit -m "feat: complete Phase 40 — Tier 4 community adapters"
```

---

## Phase 41: Admin UI — Data Sources Management

### Task 41.1: Add Data Sources to admin sidebar

**Files:**
- Modify: `src/app/(admin)/admin/layout.tsx`

Add a new entry to `ADMIN_NAV`:

```typescript
import { Database } from "lucide-react"; // add to imports

// Add to ADMIN_NAV array:
{ href: "/admin/data-sources", label: "Sources", icon: Database },
```

**Step 2: Commit**

```bash
git add src/app/\(admin\)/admin/layout.tsx
git commit -m "feat(admin): add Data Sources to admin sidebar navigation"
```

---

### Task 41.2: Create Data Sources admin page

**Files:**
- Create: `src/app/(admin)/admin/data-sources/page.tsx`

Build a `"use client"` page following the pattern from `admin/models/page.tsx`:

**Features:**
- Table showing all data sources with columns: Name, Adapter, Tier, Status (enabled/disabled), Last Sync, Records, Sync Status, Actions
- Enable/disable toggle per source (calls `PATCH /api/admin/data-sources`)
- "Sync Now" button per source (calls `POST /api/admin/sync/[source]`)
- Status badges: green for success, yellow for partial, red for failed
- Show `last_error_message` on hover or in expandable row
- Tier filter buttons (All, Tier 1, Tier 2, Tier 3, Tier 4)
- Auto-refresh every 30 seconds when a sync is running
- Use icons from lucide-react matching the data source type

**UI components used:** `Badge`, `Button`, `Card` from `@/components/ui/`, `formatDate`, `formatRelativeDate`, `formatNumber` from `@/lib/format`.

**Pattern:** Follow `admin/models/page.tsx` — `useEffect` for data fetching, `useCallback`, loading skeletons, table with pagination.

**Step 2: Commit**

```bash
git add src/app/\(admin\)/admin/data-sources/page.tsx
git commit -m "feat(admin): add Data Sources management page"
```

---

### Task 41.3: Create loading skeleton

**Files:**
- Create: `src/app/(admin)/admin/data-sources/loading.tsx`

Follow the pattern from other admin loading skeletons:

```typescript
export default function DataSourcesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-7 w-48 animate-pulse rounded-lg bg-secondary" />
        <div className="h-9 w-24 animate-pulse rounded-lg bg-secondary" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-16 animate-pulse rounded-lg bg-secondary" />
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-border/50">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-16 border-b border-border/30 animate-pulse bg-secondary/30"
            style={{ animationDelay: `${i * 50}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/\(admin\)/admin/data-sources/loading.tsx
git commit -m "feat(admin): add Data Sources loading skeleton"
```

---

### Task 41.4: Final build verification and push

1. Run `next build` — must pass with 0 errors
2. Verify all new routes appear in build output
3. Push to remote

```bash
git push origin feat/auth-fix-and-phase6-charts
```

---

## Summary of all files created/modified

| Phase | Files Created | Files Modified |
|-------|--------------|----------------|
| 36 | `src/lib/data-sources/types.ts` | `src/types/database.ts` |
| 36 | `src/lib/data-sources/utils.ts` | `.env.local.example` |
| 36 | `src/lib/data-sources/registry.ts` | |
| 36 | `src/lib/data-sources/orchestrator.ts` | |
| 36 | `src/app/api/cron/sync/route.ts` | |
| 36 | `src/app/api/admin/data-sources/route.ts` | |
| 36 | `src/app/api/admin/sync/route.ts` | |
| 36 | `src/app/api/admin/sync/[source]/route.ts` | |
| 36 | `vercel.json` | |
| 36 | 12 adapter stub files in `src/lib/data-sources/adapters/` | |
| 37 | | 5 adapter files (HF, Replicate, OpenAI, Anthropic, Google) |
| 38 | | 3 adapter files (Artificial Analysis, Open LLM, Chatbot Arena) |
| 39 | | 2 adapter files (arXiv, HF Papers) |
| 40 | | 2 adapter files (GitHub Trending, Civitai) |
| 41 | `src/app/(admin)/admin/data-sources/page.tsx` | `src/app/(admin)/admin/layout.tsx` |
| 41 | `src/app/(admin)/admin/data-sources/loading.tsx` | |

**Total: ~28 new files, ~8 modified files**
