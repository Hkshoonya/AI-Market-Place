---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Data Pipeline & Launch
status: ready-to-plan
stopped_at: Completed 23-01-PLAN.md
last_updated: "2026-03-12T16:18:40.088Z"
last_activity: "2026-03-12 — Completed 21-01: shared pipeline health lib, formatRelativeTime, admin health endpoint, sync API filtering"
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 11
  completed_plans: 9
  percent: 97
---

---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Data Pipeline & Launch
status: ready-to-plan
stopped_at: Completed 21-admin-visibility plan 01 (21-01-PLAN.md)
last_updated: "2026-03-12T04:00:31.257Z"
last_activity: 2026-03-11 — Roadmap created; 4 phases defined, 18/18 requirements mapped
progress:
  [██████████] 97%
  completed_phases: 1
  total_plans: 6
  completed_plans: 4
  percent: 94
---

---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Data Pipeline & Launch
status: ready-to-plan
last_updated: "2026-03-11T20:30:00Z"
last_activity: 2026-03-11 — Roadmap created for v1.2 (4 phases, 18 requirements mapped)
progress:
  [█████████░] 94%
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-11)

**Core value:** Most comprehensive, multi-lens ranking of AI models
**Current focus:** Phase 21 — Admin Visibility

## Current Position

Phase: 21 of 24 (Admin Visibility)
Plan: 01 complete (1/3)
Status: In Progress
Last activity: 2026-03-12 — Completed 21-01: shared pipeline health lib, formatRelativeTime, admin health endpoint, sync API filtering

Progress: [█████████░] 94%

## Performance Metrics

**v1.1 Velocity:**
- 11 phases, 29 plans, ~57 tasks
- 163 commits, 314 files changed
- Timeline: 7 days (2026-03-05 → 2026-03-11)

**v1.0 Velocity:**
- 8 phases, 28 plans
- Timeline: 2 days (2026-03-03 → 2026-03-05)

See `.planning/milestones/v1.1-ROADMAP.md` for detailed per-plan metrics.

## Accumulated Context

### Decisions

- Railway chosen for initial deployment (managed, $7-10/mo), Hetzner+Coolify as scale escape hatch
- Supabase Cloud kept ($25/mo) — integration too deep (158 files) to justify migration
- Cloudflare free tier for CDN/DNS
- node-cron replaces Vercel cron for in-process scheduling on Railway
- RSSHub sidecar not viable on Railway single-service; X/Twitter adapter uses static fallback
- [Phase 20]: pipeline_health table type added to Database typedef to resolve TypeScript never inference on typed Supabase client
- [Phase 20-pipeline-hardening]: seed-config.ts is single source of truth for all 26 adapter configs; ignoreDuplicates preserves admin overrides
- [Phase 20-pipeline-hardening]: resolveSecrets() returns { secrets, missing } — callers know which env vars are absent, orchestrator logs warning on missing
- [Phase 20-pipeline-hardening]: Two-tier secret validation: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET are core (process.exit(1)); adapter keys warn-only
- [Phase 20-pipeline-hardening]: Cron sync endpoint always returns HTTP 200 (cron job itself succeeded); overallStatus field carries partial/success signal
- [Phase 20-pipeline-hardening]: recordSyncFailure() returns Promise<number> (new count) to avoid extra DB read for Sentry threshold check in orchestrator
- [Phase 21-admin-visibility]: /api/admin/pipeline/health uses session+is_admin auth (not CRON_SECRET) for browser-safe admin data access
- [Phase 21-admin-visibility]: computeStatus extracted to shared pipeline-health-compute.ts lib to eliminate duplication between public and admin health routes
- [Phase 21-admin-visibility]: Tasks 1 and 2 in page.tsx committed atomically; array return in sortedSources.map() used for conditional expansion rows
- [Phase 21-admin-visibility]: Tasks 1 and 2 committed atomically in 05c1dd0 — both touch only page.tsx, splitting would leave file in intermediate state
- [Phase 21-admin-visibility]: 21-02 Task 3 human checkpoint approved — all 13 visual/interactive verification steps confirmed at /admin/data-sources
- [Phase 21-admin-visibility]: 21-03: adapter name (button) opens drawer; expand chevron opens inline history — two independent drill-down paths
- [Phase 21-admin-visibility]: 21-03: human verify checkpoint approved — all 11 drawer/Sync Now verification steps confirmed at /admin/data-sources
- [Phase 22-railway-deployment]: server/ directory uses CommonJS to match Next.js standalone server.js format
- [Phase 22-railway-deployment]: CRON_SECRET absence skips cron setup but server still serves HTTP (graceful degradation prevents Railway restart loops)
- [Phase 22-railway-deployment]: pingDb() helper pattern: DB check returns NextResponse|result to avoid TypeScript null inference — used in /api/health
- [Phase 22-railway-deployment]: 503 only for DB unreachable; degraded pipeline returns 200 with status: degraded — matches monitoring tool expectations
- [Phase 22-railway-deployment]: aimarketcap.tech is canonical domain; aimarketcap.com fully removed from all source files
- [Phase 23-data-integrity-verification]: TABLE_MAP uses benchmark_scores and elo_ratings -- verified by grepping actual adapter .from() calls
- [Phase 23-data-integrity-verification]: Quality score weights: completeness 40%, freshness 40%, trend 20% with linear decay 1.0->0 over 4x interval

### Pending Todos

None.

### Blockers/Concerns

- data_sources table likely unseeded in Supabase — Phase 20 fixes this (PIPE-01)
- Multiple API keys may be expired/missing — Phase 20 adds fail-fast validation (PIPE-02, PIPE-04)
- NEXT_PUBLIC_POSTHOG_KEY and SENTRY_AUTH_TOKEN must be in Railway build args
- CICD-04: Branch protection unavailable on GitHub Free + private repo
- RSSHub requires Docker sidecar — not available on Railway; X/Twitter adapter uses static fallback for now

## Session Continuity

Last session: 2026-03-12T16:18:40.084Z
Stopped at: Completed 23-01-PLAN.md
Resume file: None
