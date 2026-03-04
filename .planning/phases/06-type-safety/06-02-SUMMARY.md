---
phase: 06-type-safety
plan: 02
subsystem: type-safety
tags: [typescript, supabase, type-safety, agents, marketplace, mcp, payments]
dependency_graph:
  requires: [06-01]
  provides: [type-safe-supabase-lib]
  affects: [src/lib, src/types/database.ts, src/components]
tech_stack:
  added: []
  patterns:
    - TypedSupabaseClient parameter replacing supabase:unknown
    - AsRow<T> mapped type for database table definitions
    - cron_runs and system_logs tables added to database.ts
    - wallet RPC functions typed in database.ts Functions section
key_files:
  created: []
  modified:
    - src/types/database.ts
    - src/lib/agents/auth.ts
    - src/lib/agents/chat.ts
    - src/lib/agents/logger.ts
    - src/lib/agents/runtime.ts
    - src/lib/agents/utils.ts
    - src/lib/agents/residents/code-quality.ts
    - src/lib/agents/residents/pipeline-engineer.ts
    - src/lib/agents/residents/ux-monitor.ts
    - src/lib/cron-tracker.ts
    - src/lib/logging.ts
    - src/lib/marketplace/auctions/dutch.ts
    - src/lib/marketplace/auctions/english.ts
    - src/lib/marketplace/delivery.ts
    - src/lib/marketplace/escrow.ts
    - src/lib/mcp/prompts.ts
    - src/lib/mcp/resources.ts
    - src/lib/mcp/server.ts
    - src/lib/mcp/tools.ts
    - src/lib/payments/wallet.ts
    - src/lib/data-sources/adapters/artificial-analysis.ts
    - src/lib/data-sources/adapters/bigcode-leaderboard.ts
    - src/lib/data-sources/adapters/chatbot-arena.ts
    - src/lib/data-sources/adapters/gaia-benchmark.ts
    - src/lib/data-sources/adapters/github-stars.ts
    - src/lib/data-sources/adapters/github-trending.ts
    - src/lib/data-sources/adapters/livebench.ts
    - src/lib/data-sources/adapters/open-llm-leaderboard.ts
    - src/lib/data-sources/adapters/open-vlm-leaderboard.ts
    - src/lib/data-sources/adapters/openrouter-models.ts
    - src/lib/data-sources/adapters/osworld.ts
    - src/lib/data-sources/adapters/seal-leaderboard.ts
    - src/lib/data-sources/adapters/tau-bench.ts
    - src/lib/data-sources/adapters/terminal-bench.ts
    - src/lib/data-sources/adapters/webarena.ts
    - src/lib/data-sources/orchestrator.ts
    - src/lib/data-sources/utils.ts
    - src/components/models/comments-section.tsx
key_decisions:
  - "Retain internal `as any` in upsertBatch (data-sources/utils.ts) — dynamic table string parameter cannot be typed; outer signature uses TypedSupabaseClient"
  - "Add cron_runs and system_logs tables to database.ts — these tables existed in the DB but had no type definitions, causing casts"
  - "Add wallet RPC functions (credit_wallet, debit_wallet, hold_escrow, release_escrow, refund_escrow, increment_seller_sales, increment_listing_purchases) to database.ts Functions section"
  - "Add delivery_data field to MarketplaceOrder interface — field used by delivery.ts but missing from type"
  - "Change supabase: unknown to TypedSupabaseClient in agents/chat, logger, utils, auth — these shared helpers were typed as unknown to avoid circular deps but TypedSupabaseClient is a pure type import (no circular)"
metrics:
  duration: "~3 hours (across 2 sessions)"
  completed: "2026-03-04"
  tasks_completed: 2
  files_modified: 38
---

# Phase 06 Plan 02: Remove supabase-as-any from src/lib/ Summary

Removed all `supabase as any` and `ctx.supabase as any` casts from 35 `src/lib/` files across adapters, agents, marketplace, MCP, payments, and logging. `tsc --noEmit` passes with 0 errors.

## What Was Built

Eliminated all untyped Supabase client casts in `src/lib/` by:

1. **Task 1 — Data-source adapters (17 files):** Removed `ctx.supabase as any` from all 15 adapters, `orchestrator.ts`, and `utils.ts`. The root issue was that `Row: Interface` in database.ts was not assignable to `Record<string, unknown>` (required by the Supabase SDK `GenericTable` constraint). Fixed by adding `type AsRow<T> = { [K in keyof T]: T[K] }` and converting all 39 table Row types to use mapped types.

2. **Task 2 — Agents, marketplace, MCP, payments, logging (21 files):** Changed `supabase: unknown` parameter types to `TypedSupabaseClient` across all agent helper functions. Added missing table definitions (`cron_runs`, `system_logs`) and RPC function signatures to `database.ts`. Fixed secondary type errors caused by strict typing (enum params in MCP tools, `delivery_data` field, null safety in ux-monitor).

## Commits

| Task | Hash | Description |
|------|------|-------------|
| 1 | 0371c76 | Remove supabase-as-any from 15 data-source adapters + fix type foundation |
| 2 | 0d4df29 | Remove supabase-as-any from agents, marketplace, MCP, payments, logging |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] AsRow<T> mapped type for GenericTable compatibility**
- **Found during:** Task 1 — after removing first adapter cast
- **Issue:** `Row: InterfaceName` caused all Supabase query results to type as `never` — TypeScript interfaces don't satisfy `Record<string, unknown>` (no index signature)
- **Fix:** Added `type AsRow<T> = { [K in keyof T]: T[K] }` helper to database.ts; changed all 39 `Row: Interface` to `Row: AsRow<Interface>`. Mapped types ARE assignable to `Record<string, unknown>`
- **Files modified:** `src/types/database.ts`
- **Commit:** 0371c76

**2. [Rule 1 - Bug] benchmarkIdMap type correction in 5 adapters**
- **Found during:** Task 1
- **Issue:** `Map<string, string>` used for benchmark ID cache but `Benchmark.id` is `number` (integer PK)
- **Fix:** Changed to `Map<string, number>` / `Map<string, number | null>` in artificial-analysis, bigcode-leaderboard, livebench, open-llm-leaderboard, open-vlm-leaderboard
- **Files modified:** 5 adapter files
- **Commit:** 0371c76

**3. [Rule 1 - Bug] github-stars.ts null string handling**
- **Found during:** Task 1
- **Issue:** `model.github_url` typed as `string | null` after strict query but `parseGitHubUrl` expects `string`
- **Fix:** `parseGitHubUrl(model.github_url ?? "")`
- **Files modified:** `src/lib/data-sources/adapters/github-stars.ts`
- **Commit:** 0371c76

**4. [Rule 2 - Missing definition] cron_runs and system_logs tables added to database.ts**
- **Found during:** Task 2 — cron-tracker.ts and logging.ts use these tables
- **Issue:** Tables existed in DB but had no type definition, requiring `as any` casts
- **Fix:** Added complete `cron_runs` and `system_logs` table definitions with Row/Insert/Update/Relationships
- **Files modified:** `src/types/database.ts`
- **Commit:** 0d4df29

**5. [Rule 2 - Missing definition] Wallet RPC functions added to database.ts**
- **Found during:** Task 2 — payments/wallet.ts uses `.rpc()` calls but `Functions: Record<string, never>`
- **Issue:** All 5 wallet RPC calls (credit_wallet, debit_wallet, hold_escrow, release_escrow, refund_escrow) had no type signatures
- **Fix:** Added Functions section entries with Args and Returns types; also added increment_seller_sales and increment_listing_purchases used by escrow.ts and purchase-handlers.ts
- **Files modified:** `src/types/database.ts`
- **Commit:** 0d4df29

**6. [Rule 1 - Bug] delivery_data field missing from MarketplaceOrder**
- **Found during:** Task 2 — marketplace/delivery.ts sets delivery_data on orders
- **Issue:** `MarketplaceOrder` interface lacked `delivery_data` field used by all delivery functions
- **Fix:** Added `delivery_data: Record<string, unknown> | null` to interface and Insert type
- **Files modified:** `src/types/database.ts`
- **Commit:** 0d4df29

**7. [Rule 1 - Bug] MCP tools.ts enum type mismatches**
- **Found during:** Task 2 — after removing cast, `.eq()` received plain `string` where enum expected
- **Issue:** `params.category as string` passed to `.eq("category", ...)` which expects `ModelCategory`
- **Fix:** Changed casts to use enum types: `ModelCategory`, `ListingType`, `AgentType`, `AgentStatus`; imported these types from database.ts
- **Files modified:** `src/lib/mcp/tools.ts`
- **Commit:** 0d4df29

**8. [Rule 1 - Bug] comments-section.tsx two-query enrichment cast**
- **Found during:** Task 2 — introduced by AsRow<T> changes in database.ts making `comments` Row type incompatible with `Comment` interface
- **Issue:** `rawData as Comment[]` failed — `Comment` includes joined `profiles` field but DB row type doesn't
- **Fix:** Changed to `rawData as unknown as Comment[]` (standard double-cast for two-query enrichment pattern)
- **Files modified:** `src/components/models/comments-section.tsx`
- **Commit:** 0d4df29

**9. [Rule 1 - Bug] ux-monitor.ts ratingData null safety**
- **Found during:** Task 2 — after removing cast, TypeScript spotted `ratingData.length` could be null
- **Fix:** Introduced `const ratingRows = ratingData ?? []` variable, used throughout
- **Files modified:** `src/lib/agents/residents/ux-monitor.ts`
- **Commit:** 0d4df29

### Justified Retained Cast

**`src/lib/data-sources/utils.ts` line 100:** `const sb = supabase as any` retained internally inside `upsertBatch`. The function parameter is typed as `TypedSupabaseClient`, but the internal `sb.from(table)` call uses a dynamic `table: string` parameter that cannot be statically typed against the database schema. The cast is scoped to 3 lines inside one function and is documented with a comment.

### Deferred Items

**`src/lib/payments/withdraw.ts`** — Contains 2 `createAdminClient() as any` casts. This file was not in the plan's file list for Task 2. Logged for a future type-safety plan.

## Verification

- `npx tsc --noEmit`: **0 errors** (down from pre-task baseline with uncommitted marketplace route changes)
- All 35 planned files updated
- One internal justified cast retained in `upsertBatch`
