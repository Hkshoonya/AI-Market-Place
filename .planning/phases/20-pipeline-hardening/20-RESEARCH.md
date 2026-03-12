# Phase 20: Pipeline Hardening - Research

**Researched:** 2026-03-11
**Domain:** Next.js data pipeline — startup seeding, secret validation, failure reporting, health endpoints
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Seeding strategy**
- Seed on app startup via `seedDataSources()` — not migration-only
- Source of truth: centralized config file (`src/lib/data-sources/seed-config.ts`) mapping all 27 adapters to tier, priority, interval, secret_env_keys, output_types
- Insert-only mode: `ON CONFLICT (slug) DO NOTHING` — existing rows untouched, admin overrides preserved
- New adapters auto-appear on next deploy without manual SQL
- If `data_sources` table doesn't exist: fail startup with clear error ("Run Supabase migrations first") and `process.exit(1)`

**Secret validation strictness**
- Two tiers of secrets: **core** (fail startup) vs **adapter** (warn only)
- Core secrets that fail startup: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`
- Adapter secrets: warn per adapter, mark as degraded (static-only mode), app continues
- `resolveSecrets()` returns `{ secrets, missing }` — caller decides how to handle
- Startup log: summary table format — "Pipeline secrets: 25/27 configured" then list only missing ones with their adapter name

**Failure reporting**
- Cron sync endpoint always returns HTTP 200 (cron job itself succeeded), with per-adapter success/failure breakdown in response body
- Body includes: `tier`, `sourcesRun`, `sourcesSucceeded`, `sourcesFailed`, `details[]` with per-adapter status and error
- Sentry alert after 3+ consecutive failures per adapter (uses `pipeline_health.consecutive_failures`)
- Each adapter failure writes a structured `system_logs` entry: adapter name, error message, retries attempted, tier, duration_ms, consecutive failure count
- Retry scope: HTTP-level only via existing `fetchWithRetry` (3 retries, exponential backoff) — no orchestrator-level adapter retry needed

**Health endpoint design**
- Two separate endpoints: `/api/health` (app-level, Phase 22) and `/api/pipeline/health` (pipeline-specific, this phase)
- `/api/pipeline/health` returns full per-adapter detail: slug, status, lastSync, consecutiveFailures, recordCount, error
- Auth model: public request gets summary only (`status`, `healthy`, `degraded`, `down` counts); authenticated request (Bearer CRON_SECRET) gets full adapter breakdown
- Status determination: combine consecutive_failures AND staleness, worst wins
  - `consecutive_failures == 0` AND synced within interval → healthy
  - `consecutive_failures 1-2` OR `last_sync > 2x expected_interval` → degraded
  - `consecutive_failures >= 3` OR `last_sync > 4x expected_interval` → down
- Top-level `status` field: "healthy" if all adapters healthy, "degraded" if any degraded, "down" if any down

### Claude's Discretion
- Exact structure of seed-config.ts entries (field names, grouping)
- How to wire seedDataSources() into app startup (instrumentation.ts vs middleware vs standalone)
- Zod schema for health endpoint response
- Whether to add healthCheck pre-validation before each adapter sync in orchestrator
- Exact Sentry severity level and tag structure for consecutive failure alerts

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PIPE-01 | System seeds `data_sources` table with all 27 adapters on first deploy | `seedDataSources()` reads from seed-config.ts; uses `ON CONFLICT (slug) DO NOTHING`; wired into instrumentation.ts register() |
| PIPE-02 | `resolveSecrets()` fails fast with clear error when required API keys are missing | Refactor resolveSecrets() to return `{ secrets, missing }`; core secrets call process.exit(1); adapter secrets emit warn log |
| PIPE-03 | Orchestrator reports per-adapter success/failure status (not silent 200 OK) | OrchestratorResult already has sourcesSucceeded/sourcesFailed; cron route returns these in body; Sentry fires at 3+ consecutive failures |
| PIPE-04 | All adapter API keys validated on app startup with clear log output | `validatePipelineSecrets()` called in instrumentation.ts; summary table format log output |
| PIPE-05 | Failed syncs automatically retry with exponential backoff (max 3 retries) | Already satisfied by `fetchWithRetry` (3 retries, exponential backoff, 429/5xx) — PIPE-05 is verify-and-document only |
| PIPE-06 | Each adapter exposes a health check (connectivity + auth validation) | `DataSourceAdapter.healthCheck()` interface already defined; `createAdapterSyncer` already implements it for shared-factory adapters; non-factory adapters need verification |
| PIPE-07 | `/api/pipeline/health` endpoint returns aggregate pipeline status | New `src/app/api/pipeline/health/route.ts`; reads pipeline_health + data_sources; public summary / authed detail |
</phase_requirements>

---

## Summary

Phase 20 hardens a pipeline that already has significant infrastructure in place. The core types (`DataSourceAdapter` with `healthCheck`), retry logic (`fetchWithRetry`), health tracking (`pipeline_health` table, `recordSyncSuccess/recordSyncFailure`), structured logging (`systemLog`, `createTaggedLogger`), and orchestrator result schema (`OrchestratorResult` with per-adapter details) all exist. The gaps are specific and surgical: the `data_sources` table must be seeded programmatically from code (not just migrations), secret validation needs a fail-fast path for core secrets, the cron endpoint must include failure details in its response body, and the health HTTP endpoint does not yet exist.

The 27 adapters are registered in `registry.ts` via `loadAllAdapters()` (26 imports confirmed; one adapter `deployment-pricing` appears in the adapters directory but the count of 27 references in the CONTEXT.md likely includes this or one additional adapter from migration data). The `seed-config.ts` must define all 27 with fields matching `DataSource` type in `src/types/database.ts` (id, slug, name, adapter_type, tier, sync_interval_hours, priority, secret_env_keys, output_types, config, is_enabled).

The wiring point for startup tasks is `instrumentation.ts` `register()` — already used for Sentry and MSW, guarded by `process.env.NEXT_RUNTIME === "nodejs"`. This is the correct hook for `seedDataSources()` and `validatePipelineSecrets()`.

**Primary recommendation:** Build three new modules (`seed-config.ts`, `seedDataSources()` in a startup module, `validatePipelineSecrets()`), refactor `resolveSecrets()` to return `{ secrets, missing }`, update the cron route to emit structured failure body + Sentry alerts, and add `src/app/api/pipeline/health/route.ts` following the same Bearer-token auth pattern used by other cron routes.

---

## Standard Stack

### Core (already in project — no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | existing | DB access for seed + health queries | Project standard; admin client (`createAdminClient`) already in use |
| `@sentry/nextjs` | existing | Consecutive failure alerts | Already wired in `handleApiError`; used across 65 routes |
| `zod` | existing | Health endpoint response schema validation | Used at 62 query boundary sites; project mandate |
| `next` instrumentation API | existing | Startup hook for seeding + secret validation | `instrumentation.ts` already registered |

### No New Dependencies

All required capabilities exist in the current stack. This phase is pure code reorganization and gap-filling.

---

## Architecture Patterns

### Recommended File Structure (new files only)

```
src/lib/data-sources/
├── seed-config.ts           # NEW: centralized 27-adapter definition array
├── seeder.ts                # NEW: seedDataSources() function
src/lib/pipeline/
├── startup.ts               # NEW: validatePipelineSecrets(), startupChecks()
src/app/api/pipeline/
└── health/
    └── route.ts             # NEW: GET /api/pipeline/health
src/lib/data-sources/
└── utils.ts                 # MODIFY: resolveSecrets() → { secrets, missing }
src/app/api/cron/sync/
└── route.ts                 # MODIFY: include failure details + Sentry alert
src/
└── instrumentation.ts       # MODIFY: wire seedDataSources() + validatePipelineSecrets()
```

### Pattern 1: Seed Config Entry Shape

Each entry in `seed-config.ts` must match the `DataSource` type from `src/types/database.ts` (minus auto-managed fields like `id`, `created_at`, `updated_at`, `last_sync_*`):

```typescript
// src/lib/data-sources/seed-config.ts
export interface SeedEntry {
  slug: string;
  name: string;
  adapter_type: string;         // must match DataSourceAdapter.id in registry
  description: string;
  tier: 1 | 2 | 3 | 4;
  sync_interval_hours: number;
  priority: number;             // lower = runs first within tier
  secret_env_keys: string[];    // must match adapter.requiredSecrets
  output_types: SyncOutputType[];
  config: Record<string, unknown>;
  is_enabled: boolean;
}

export const DATA_SOURCE_SEEDS: SeedEntry[] = [
  // Tier 1 — Primary discovery (runs most frequently)
  { slug: "openrouter-models", adapter_type: "openrouter-models", tier: 1, priority: 5, ... },
  { slug: "huggingface", adapter_type: "huggingface", tier: 1, priority: 15, ... },
  // ... all 27 entries
];
```

**Source of truth for field values:** Cross-reference migration `002_enable_free_pipeline.sql` INSERT statements for existing slugs, and `loadAllAdapters()` in `registry.ts` for adapter_type values. The adapter_type field MUST match the `id` property in each adapter's `registerAdapter()` call.

### Pattern 2: Startup Wiring via instrumentation.ts

```typescript
// src/instrumentation.ts (modified)
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");

    // Pipeline startup: seed + validate
    const { validatePipelineSecrets } = await import("@/lib/pipeline/startup");
    const { seedDataSources } = await import("@/lib/data-sources/seeder");

    await validatePipelineSecrets();  // exits on missing core secrets
    await seedDataSources();          // idempotent INSERT OR IGNORE

    // E2E test MSW (existing)
    if (process.env.NEXT_PUBLIC_E2E_MSW === "true") { ... }
  }
}
```

**Why instrumentation.ts:** Next.js runs `register()` exactly once per Node.js process startup, before any request handlers. This is the official Next.js hook for server-side initialization code. The existing `instrumentation.ts` already uses this pattern for Sentry.

### Pattern 3: resolveSecrets() Refactor

```typescript
// BEFORE (current — silently drops missing)
export function resolveSecrets(envKeys: string[]): Record<string, string>

// AFTER (returns structured result)
export function resolveSecrets(envKeys: string[]): {
  secrets: Record<string, string>;
  missing: string[];
}
```

Callers in `orchestrator.ts` currently do `const secrets = resolveSecrets(source.secret_env_keys)`. All call sites must be updated to destructure `{ secrets, missing }`. The `missing` array allows the orchestrator to log which adapter secrets are absent and mark the source degraded.

### Pattern 4: Health Endpoint Auth (Bearer CRON_SECRET pattern)

```typescript
// src/app/api/pipeline/health/route.ts
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const isAuthenticated = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  // Public: summary counts only
  // Authenticated: full per-adapter breakdown
  const data = await buildHealthResponse(isAuthenticated);
  return NextResponse.json(data);
}
```

This mirrors the auth pattern in `src/app/api/cron/sync/route.ts` exactly.

### Pattern 5: Sentry Alert on Consecutive Failures

```typescript
// In orchestrator.ts executeAdapter(), after recordSyncFailure():
if (updatedFailureCount >= 3) {
  Sentry.captureMessage(`Pipeline adapter consecutive failures: ${source.slug}`, {
    level: "warning",
    tags: {
      adapter: source.slug,
      adapter_type: source.adapter_type,
      tier: String(source.tier),
    },
    extra: {
      consecutiveFailures: updatedFailureCount,
      lastError: syncResult.errors[0]?.message,
    },
  });
}
```

Use `Sentry.captureMessage` (not `captureException`) since this is a health signal, not an unhandled exception. Level "warning" for 3 failures.

### Anti-Patterns to Avoid

- **Don't call `process.exit(1)` inside a try/catch in startup:** Exit must happen AFTER the error is logged to console (DB write may fail if Supabase URL is missing). Log to `console.error` first, then exit.
- **Don't seed data_sources inside a cron route:** Seeding must happen at startup, not at request time. Cron routes are called repeatedly.
- **Don't change the cron route HTTP status for adapter failures:** The decision is: HTTP 200 always (cron infrastructure succeeded), failure details in body. Changing to 500 would cause cron job frameworks to retry the whole run.
- **Don't use `ON CONFLICT DO UPDATE` for seeding:** Admin overrides (tier changes, enable/disable) would be overwritten on every deploy. Insert-only with `DO NOTHING` preserves admin state.
- **Don't add adapter retry at the orchestrator level:** `fetchWithRetry` already handles HTTP-level retries with exponential backoff. An orchestrator-level retry would double-retry and potentially cause 6x load on external APIs.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP retry with backoff | Custom retry loop | `fetchWithRetry` in `utils.ts` | Already handles 429/5xx, Retry-After header, AbortSignal, configurable maxRetries |
| Structured DB logging | console.log | `systemLog` / `createTaggedLogger` in `logging.ts` | Writes to `system_logs` table with metadata JSONB, falls back to console |
| Admin Supabase client | `createClient(url, key)` inline | `createAdminClient()` from `@/lib/supabase/admin` | Typed with Database type, service role, consistent |
| Failure/success health tracking | Custom counter | `recordSyncSuccess/recordSyncFailure` in `pipeline-health.ts` | Already manages `consecutive_failures` in `pipeline_health` table |
| API error handling in routes | try/catch + Response | `handleApiError` from `@/lib/api-error` | Sentry-integrated, logs to system_logs, returns typed error response |
| Cron run tracking | Manual DB inserts | `trackCronRun` from `@/lib/cron-tracker` | Creates cron_runs row, tracks duration, handles complete/fail lifecycle |

**Key insight:** The pipeline infrastructure is largely complete. PIPE-05 (retry) is already satisfied by `fetchWithRetry`. PIPE-06 (healthCheck interface) is already defined in the `DataSourceAdapter` interface and implemented in `createAdapterSyncer`. The work is wiring and surfacing — not building new infrastructure.

---

## Common Pitfalls

### Pitfall 1: Adapter Count Mismatch (seed-config vs registry)

**What goes wrong:** `seed-config.ts` lists 27 adapters but `loadAllAdapters()` only imports 26 — or vice versa — causing either orphaned DB rows or adapters that run but have no DB record.

**Why it happens:** The registry (`registry.ts`) imports 26 adapter modules via dynamic imports. The migration `002_enable_free_pipeline.sql` adds adapters via SQL that may not match the code. `provider-pricing.ts` exists in the adapters directory but is a data file, not an adapter (no `registerAdapter` call, no `id` field). The 27th adapter count from the CONTEXT.md may include `deployment-pricing` (confirmed in registry) plus one that is in migrations but not in code, or vice versa.

**How to avoid:** When building seed-config.ts, enumerate adapter IDs by running `listAdapters()` after `loadAllAdapters()` — the runtime list is the authoritative set. Verify seed-config.ts slug list matches this exactly.

**Warning signs:** At startup, log "Seeded N adapters, registry has M adapters" — if N != M, warn loudly.

### Pitfall 2: Core Secret Validation Runs Before Sentry is Initialized

**What goes wrong:** `validatePipelineSecrets()` is called in `instrumentation.ts`, but if it errors before Sentry initializes, the error won't be captured.

**How to avoid:** Place Sentry initialization FIRST in `register()`, then call startup checks. This is already the correct order since the existing code does `await import("../sentry.server.config")` at the top. Pipeline startup imports go AFTER this.

### Pitfall 3: resolveSecrets Callers Not Updated

**What goes wrong:** After refactoring `resolveSecrets()` to return `{ secrets, missing }`, the orchestrator (`orchestrator.ts:71`) still destructures it as a plain `Record<string, string>`, causing a TypeScript error or runtime type mismatch.

**How to avoid:** Update ALL call sites. Search for `resolveSecrets(` — there is one call in `orchestrator.ts` and the function is exported from `utils.ts`. Update TypeScript types first; the compiler will flag all stale usages.

### Pitfall 4: seedDataSources() Fails Silently If Table Doesn't Exist

**What goes wrong:** Supabase returns an error when querying a non-existent table. If `seedDataSources()` catches all errors and continues, the pipeline runs without a seeded DB.

**How to avoid:** Check for table existence error explicitly: if the Supabase error code is `42P01` (table not found), log `"Run Supabase migrations first"` to console.error and call `process.exit(1)`.

### Pitfall 5: Health Endpoint Queries Are Slow on Cold Start

**What goes wrong:** `/api/pipeline/health` joins `pipeline_health` and `data_sources` tables — if these tables have no indexes on the join column (`source_slug` / `slug`), cold queries will table-scan.

**How to avoid:** `pipeline_health` has `source_slug TEXT PRIMARY KEY` (from migration 014) — primary key implies index. `data_sources.slug` has `UNIQUE` constraint (from migration 001) — unique implies index. No additional indexes needed.

### Pitfall 6: process.exit(1) in instrumentation.ts Kills Test Runner

**What goes wrong:** Unit tests that import any module transitively importing the startup module will trigger `process.exit(1)` if `SUPABASE_URL` is missing in the test environment.

**How to avoid:** Guard `process.exit(1)` with `process.env.NODE_ENV !== "test"`. Or structure `validatePipelineSecrets()` to return a result object and only call `process.exit(1)` at the call site in `instrumentation.ts`. The latter is cleaner for testability.

---

## Code Examples

Verified patterns from existing codebase:

### Health Status Calculation (from CONTEXT.md decision, using existing pipeline_health columns)

```typescript
// src/app/api/pipeline/health/route.ts
function computeStatus(row: {
  consecutive_failures: number;
  last_success_at: string | null;
  expected_interval_hours: number;
}): "healthy" | "degraded" | "down" {
  const failures = row.consecutive_failures;
  const intervalMs = row.expected_interval_hours * 60 * 60 * 1000;
  const sinceLastSync = row.last_success_at
    ? Date.now() - new Date(row.last_success_at).getTime()
    : Infinity;

  if (failures >= 3 || sinceLastSync > 4 * intervalMs) return "down";
  if (failures >= 1 || sinceLastSync > 2 * intervalMs) return "degraded";
  return "healthy";
}
```

### Zod Schema for Health Response

```typescript
import { z } from "zod";

const AdapterHealthSchema = z.object({
  slug: z.string(),
  status: z.enum(["healthy", "degraded", "down"]),
  lastSync: z.string().nullable(),
  consecutiveFailures: z.number(),
  recordCount: z.number(),
  error: z.string().nullable(),
});

const PipelineHealthSummarySchema = z.object({
  status: z.enum(["healthy", "degraded", "down"]),
  healthy: z.number(),
  degraded: z.number(),
  down: z.number(),
  checkedAt: z.string(),
});

const PipelineHealthDetailSchema = PipelineHealthSummarySchema.extend({
  adapters: z.array(AdapterHealthSchema),
});
```

### Updated cron/sync/route.ts body shape

```typescript
// After runTierSync(), before tracker.complete():
const hasFailed = result.sourcesFailed > 0;

// Sentry alert for 3+ consecutive failures (handled in orchestrator — not here)
// Route always returns 200; failure details surfaced in body

return tracker.complete({
  tier: result.tier,
  sourcesRun: result.sourcesRun,
  sourcesSucceeded: result.sourcesSucceeded,
  sourcesFailed: result.sourcesFailed,
  details: result.details.map((d) => ({
    source: d.source,
    status: d.status,
    records: d.recordsProcessed,
    durationMs: d.durationMs,
    errors: d.errors.map((e) => e.message),  // expose error messages in body
  })),
  overallStatus: hasFailed ? "partial" : "success",
});
```

### System log for adapter failure (in orchestrator.ts)

```typescript
// After executeAdapter() returns a failed result:
await systemLog.error("sync-orchestrator", "Adapter sync failed", {
  adapter: source.slug,
  adapter_type: source.adapter_type,
  tier: source.tier,
  durationMs: detail.durationMs,
  consecutiveFailures: updatedFailureCount,  // from pipeline_health after recordSyncFailure
  error: detail.errors[0]?.message ?? "unknown",
  retriesAttempted: 3,  // fetchWithRetry default maxRetries
});
```

---

## State of the Art

| Old Approach | Current Approach | Impact for This Phase |
|--------------|------------------|----------------------|
| Manual SQL INSERT for data sources | `seed-config.ts` + `seedDataSources()` on startup | Enables PIPE-01: no manual SQL on first deploy |
| `resolveSecrets()` silently drops missing keys | Returns `{ secrets, missing }` | Enables PIPE-02/PIPE-04: fail-fast path for core secrets |
| Cron route returns terse `{ ok: true }` | Returns full `details[]` with per-adapter errors | Enables PIPE-03: visible failure reporting |
| `httpWithRetry` already implemented | Verify 3-retry, exponential backoff, 429/5xx | PIPE-05 is already satisfied — document and verify |
| `healthCheck` on DataSourceAdapter interface | Already implemented in `createAdapterSyncer` | PIPE-06 satisfied for shared-factory adapters |
| No pipeline health HTTP endpoint | `GET /api/pipeline/health` | Enables PIPE-07 |

**Existing infrastructure already satisfying requirements:**
- PIPE-05: `fetchWithRetry` in `utils.ts:25-63` — 3 retries, exponential backoff, 429/5xx handling. Confirmed HIGH confidence.
- PIPE-06: `healthCheck(secrets)` on `DataSourceAdapter` interface (`types.ts:103`) — all adapters using `createAdapterSyncer` implement it. Non-factory adapters (huggingface, replicate, chatbot-arena, arxiv, etc.) implement `healthCheck` directly.

---

## Adapter Inventory (all 26 registered + expected 27th)

Adapters confirmed in `loadAllAdapters()` and matching adapter IDs in files:

| # | adapter_type (id) | secret_env_keys | tier |
|---|-------------------|-----------------|------|
| 1 | huggingface | [] (optional HUGGINGFACE_API_TOKEN) | 1 |
| 2 | replicate | [] | 1 |
| 3 | openai-models | [] | 1 |
| 4 | anthropic-models | [] | 1 |
| 5 | google-models | [] | 1 |
| 6 | openrouter-models | [] | 1 |
| 7 | artificial-analysis | [] | 2 |
| 8 | open-llm-leaderboard | [] | 2 |
| 9 | chatbot-arena | [] | 2 |
| 10 | arxiv | [] | 2 |
| 11 | hf-papers | [] | 2 |
| 12 | github-trending | [] | 2 |
| 13 | civitai | [CIVITAI_API_KEY] | 2 |
| 14 | provider-news | [] | 3 |
| 15 | x-announcements | [] | 3 |
| 16 | livebench | [] | 2 |
| 17 | seal-leaderboard | [] | 2 |
| 18 | bigcode-leaderboard | [] | 2 |
| 19 | open-vlm-leaderboard | [] | 2 |
| 20 | terminal-bench | [] | 2 |
| 21 | osworld | [] | 2 |
| 22 | gaia-benchmark | [] | 2 |
| 23 | webarena | [] | 2 |
| 24 | tau-bench | [] | 2 |
| 25 | github-stars | [GITHUB_TOKEN] | 3 |
| 26 | deployment-pricing | [] | 3 |

**Note:** 26 adapters confirmed via registry.ts imports and adapter file id fields. The CONTEXT.md references "27 adapters." The 27th is likely an adapter present in the `data_sources` table via earlier migrations but not yet in `loadAllAdapters()`. When building seed-config.ts, run `listAdapters()` post-`loadAllAdapters()` to get the authoritative list and reconcile against the DB.

---

## Open Questions

1. **What is the 27th adapter?**
   - What we know: 26 adapter files confirmed; CONTEXT.md says 27
   - What's unclear: Migration SQL INSERTs may reference a slug not in the current `loadAllAdapters()` list (e.g., an adapter added to migrations but not to the registry, or `provider-pricing` used as a data adapter somewhere)
   - Recommendation: When building seed-config.ts, query `SELECT slug FROM data_sources` from the live Supabase DB and diff against `listAdapters()` output. The gap is the 27th.

2. **Should seedDataSources() also seed pipeline_health?**
   - What we know: Migration 014 seeds `pipeline_health` from `data_sources`, but this is a one-time SQL migration. New entries from `seedDataSources()` won't auto-appear in `pipeline_health`.
   - What's unclear: Whether `recordSyncSuccess`/`recordSyncFailure` use upsert (they do — confirmed they use `ON CONFLICT (source_slug)`) so pipeline_health rows auto-create on first sync.
   - Recommendation: No separate seeding of pipeline_health needed; upsert on first sync handles it.

3. **Does instrumentation.ts run in all Railway deployment modes?**
   - What we know: Next.js runs `register()` in Node.js runtime only. On Railway, the app runs as `next start` which uses Node.js.
   - Recommendation: The `process.env.NEXT_RUNTIME === "nodejs"` guard is correct and will execute on Railway.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (projects: unit/component) |
| Config file | `vitest.config.ts` |
| Quick run command | `vitest run --project unit` |
| Full suite command | `vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PIPE-01 | `seedDataSources()` inserts new adapters, skips existing | unit | `vitest run --project unit src/lib/data-sources/seeder.test.ts` | ❌ Wave 0 |
| PIPE-02 | `resolveSecrets()` returns `{ secrets, missing }` correctly | unit | `vitest run --project unit src/lib/data-sources/utils.test.ts` | ❌ Wave 0 |
| PIPE-03 | Cron route body includes sourcesFailed + per-adapter errors | unit (mock runTierSync) | `vitest run --project unit src/app/api/cron/sync/route.test.ts` | ❌ Wave 0 |
| PIPE-04 | `validatePipelineSecrets()` logs summary, exits on missing core secrets | unit | `vitest run --project unit src/lib/pipeline/startup.test.ts` | ❌ Wave 0 |
| PIPE-05 | `fetchWithRetry` retries 429/5xx up to 3 times with exponential backoff | unit | `vitest run --project unit src/lib/data-sources/utils.test.ts` | ❌ Wave 0 (utils.ts has no test yet) |
| PIPE-06 | `healthCheck()` returns healthy when API key absent (static-only mode) | unit | `vitest run --project unit src/lib/data-sources/shared/adapter-syncer.test.ts` | ❌ Wave 0 |
| PIPE-07 | `GET /api/pipeline/health` public path returns summary counts only | unit | `vitest run --project unit src/app/api/pipeline/health/route.test.ts` | ❌ Wave 0 |
| PIPE-07 | `GET /api/pipeline/health` authed path returns adapter breakdown | unit | same file | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `vitest run --project unit` (unit tests only, fast)
- **Per wave merge:** `vitest run` (unit + component)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/lib/data-sources/seeder.test.ts` — covers PIPE-01 (mock Supabase client, verify upsert called with correct slugs, verify DO NOTHING behavior)
- [ ] `src/lib/data-sources/utils.test.ts` — covers PIPE-02, PIPE-05 (refactored resolveSecrets + fetchWithRetry — mock fetch)
- [ ] `src/lib/pipeline/startup.test.ts` — covers PIPE-04 (mock process.exit, verify log output format)
- [ ] `src/app/api/cron/sync/route.test.ts` — covers PIPE-03 (mock runTierSync, verify body structure)
- [ ] `src/lib/data-sources/shared/adapter-syncer.test.ts` — covers PIPE-06 (healthCheck with/without API key)
- [ ] `src/app/api/pipeline/health/route.test.ts` — covers PIPE-07 (mock Supabase, verify public vs authed response)

**Vitest mock pattern for Supabase (follows existing test patterns in codebase):**
```typescript
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({ select: vi.fn(), upsert: vi.fn(), ... }))
  }))
}));
```

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection — `src/lib/data-sources/utils.ts`, `orchestrator.ts`, `registry.ts`, `types.ts`, `pipeline-health.ts`, `logging.ts`, `cron-tracker.ts`
- Direct codebase inspection — `src/instrumentation.ts`, `src/lib/api-error.ts`, `src/lib/supabase/admin.ts`
- Direct codebase inspection — `src/lib/data-sources/shared/adapter-syncer.ts` (healthCheck implementation)
- Direct codebase inspection — `supabase/migrations/` (014, 009, 002, 001 — table schemas)
- Direct codebase inspection — all 26 adapter files (id fields, requiredSecrets, healthCheck presence)
- Next.js official instrumentation docs pattern — confirmed by existing `instrumentation.ts` usage

### Secondary (MEDIUM confidence)

- Next.js instrumentation.ts behavior on Railway: inferred from `process.env.NEXT_RUNTIME === "nodejs"` guard and Railway running `next start` in Node.js mode — not independently verified against Railway docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are existing project dependencies; no new installs
- Architecture: HIGH — patterns verified directly from codebase code inspection
- Pitfalls: HIGH — identified from actual code gaps (26 vs 27 adapters, resolveSecrets call sites, instrumentation ordering)
- Test gaps: HIGH — all test files confirmed absent via filesystem search

**Research date:** 2026-03-11
**Valid until:** 2026-04-10 (stable Next.js/Supabase stack, 30-day window)
