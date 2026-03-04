---
phase: 07-error-handling-logging
plan: 03
subsystem: api-routes
tags: [error-handling, logging, api-routes, admin, cron, charts, models]
dependency_graph:
  requires: [07-01]
  provides: [ERR-02, LOG-02]
  affects: [all-non-marketplace-api-routes]
tech_stack:
  added: []
  patterns:
    - handleApiError wrapping all route catch blocks
    - createTaggedLogger for cron routes with multiple log calls
    - systemLog.warn for non-critical notification/auth failures
    - Outer try/catch on every handler body
key_files:
  created: []
  modified:
    - src/app/api/admin/agents/[id]/route.ts
    - src/app/api/admin/agents/logs/route.ts
    - src/app/api/admin/agents/route.ts
    - src/app/api/admin/agents/tasks/route.ts
    - src/app/api/admin/backfill-news/route.ts
    - src/app/api/admin/bootstrap/route.ts
    - src/app/api/admin/data-sources/route.ts
    - src/app/api/admin/listings/route.ts
    - src/app/api/admin/moderate/route.ts
    - src/app/api/admin/sync/[source]/route.ts
    - src/app/api/admin/sync/route.ts
    - src/app/api/admin/verifications/route.ts
    - src/app/api/agents/chat/route.ts
    - src/app/api/agents/conversations/[id]/messages/route.ts
    - src/app/api/agents/conversations/route.ts
    - src/app/api/api-keys/[id]/route.ts
    - src/app/api/api-keys/route.ts
    - src/app/api/auth/delete-account/route.ts
    - src/app/api/cron/agents/code-quality/route.ts
    - src/app/api/cron/agents/pipeline/route.ts
    - src/app/api/cron/agents/ux-monitor/route.ts
    - src/app/api/cron/auctions/route.ts
    - src/app/api/cron/compute-scores/route.ts
    - src/app/api/cron/sync/route.ts
    - src/app/api/bookmarks/route.ts
    - src/app/api/charts/benchmark-heatmap/route.ts
    - src/app/api/charts/market-kpis/route.ts
    - src/app/api/charts/quality-price/route.ts
    - src/app/api/charts/rank-timeline/route.ts
    - src/app/api/charts/ticker/route.ts
    - src/app/api/charts/top-movers/route.ts
    - src/app/api/charts/trading/route.ts
    - src/app/api/contact/route.ts
    - src/app/api/activity/route.ts
    - src/app/api/notifications/preferences/route.ts
    - src/app/api/notifications/route.ts
    - src/app/api/rankings/route.ts
    - src/app/api/search/route.ts
    - src/app/api/trending/route.ts
    - src/app/api/models/[slug]/deployments/route.ts
    - src/app/api/models/[slug]/description/route.ts
    - src/app/api/models/[slug]/route.ts
    - src/app/api/models/route.ts
    - src/app/api/mcp/route.ts
decisions:
  - "All handler bodies wrapped in outer try/catch delegating to handleApiError — eliminates inline error construction"
  - "createTaggedLogger used for cron/auctions and cron/compute-scores which have multiple log call sites"
  - "systemLog.warn used for non-critical failures (notification inserts, auth deletion) — fire-and-forget with void prefix"
  - "Source naming follows convention: api/admin/{name}, cron/{name}, api/agents/{name}, api/charts/{name}, api/models"
metrics:
  duration: ~35
  completed_date: "2026-03-04"
  tasks: 2
  files: 44
---

# Phase 07 Plan 03: Migrate Non-Marketplace API Routes to handleApiError + Structured Logging Summary

Migrated all 44 non-marketplace API routes to use handleApiError for consistent error responses and replaced all console.error/warn calls with structured logging via systemLog or createTaggedLogger.

## What Was Built

- **44 route files** across admin, cron, auth, agents, api-keys, charts, models, and utility namespaces now use `handleApiError` in every catch block
- **101 handleApiError usages** across non-marketplace routes (verified via grep count)
- **Zero console.error/warn** remaining in non-marketplace API routes
- **Consistent error shape** — all error responses return `{ error: string }` with correct HTTP status
- **Cron routes** use `createTaggedLogger` with `cron/` source prefix for correlated log filtering

## Tasks Completed

### Task 1: Admin, Cron, Auth, Agent Routes (24 files)
- Admin routes (12): agents/[id], agents/logs, agents, agents/tasks, backfill-news, bootstrap, data-sources, listings, moderate, sync/[source], sync, verifications
- Agent routes (3): agents/chat, conversations/[id]/messages, conversations
- API-key routes (2): api-keys/[id], api-keys
- Auth routes (1): auth/delete-account
- Cron routes (6): agents/code-quality, agents/pipeline, agents/ux-monitor, auctions, compute-scores, sync
- Commit: b9501ac

### Task 2: Charts, Models, Utility Routes (20 files)
- Bookmarks, activity, contact, notifications (2), rankings, search, trending
- Charts (7): benchmark-heatmap, market-kpis, quality-price, rank-timeline, ticker, top-movers, trading
- Models (4): route, [slug]/route, [slug]/deployments, [slug]/description
- MCP route
- Commit: e8bf3fe

## Deviations from Plan

None — plan executed exactly as written. All files followed the mechanical migration pattern described in the task instructions.

## Key Decisions Made

1. **Outer try/catch wrapping** — Rather than only wrapping `executeAgent` or similar async operations, wrapped entire handler bodies in try/catch. This protects against unexpected throws from auth checks, Supabase client creation, and URL parsing.

2. **Non-critical notification failures use systemLog.warn** — In admin/moderate.ts and admin/verifications.ts, notification insert failures are non-critical side effects. These use `void systemLog.warn(...)` (fire-and-forget) rather than failing the primary request.

3. **Auth deletion fallback in delete-account.ts** — The two console.error calls for auth user deletion failures were replaced with `void systemLog.warn(...)` — the profile is already anonymized at that point, so auth deletion is best-effort.

4. **createTaggedLogger for cron/auctions and cron/compute-scores** — These routes have multiple logging call sites within their handler bodies; tagged logger reduces boilerplate and ensures consistent source tagging.

## Self-Check: PASSED

- src/app/api/cron/compute-scores/route.ts — FOUND
- src/app/api/admin/moderate/route.ts — FOUND
- src/app/api/contact/route.ts — FOUND
- Commit b9501ac (Task 1) — FOUND
- Commit e8bf3fe (Task 2) — FOUND
