# Roadmap Audit Status — 2026-03-19

## Scope

This audit covers the implementation burst from the early March milestone work through the resumed recovery work completed on March 19, 2026. It maps roadmap themes to current code evidence and recent live production fixes.

The strict per-file matrix lives in `docs/plans/2026-03-19-plan-matrix.md`.

Reference head at audit time:

- Local / GitHub `main`: `490c6eb90d86b52d04e5e66e925ed139f7c1e444`

Recovery tracking note:

- `docs/plans/2026-03-19-recovery-tracking.md`

## Executive Summary

The roadmap is not fully closed, but the majority of the implementation-heavy slices are in code and many of the highest-risk production gaps have now been fixed live:

- cron scheduling and health visibility materially improved
- wallet funding refresh is now scheduled
- financial integrity protections were added around duplicate purchase and order completion
- resident-agent cron failures now surface as actual failing health signals

What remains is mostly verification, operator-facing closure, and a few deeper control-loop/runtime hardening tasks rather than broad net-new feature construction.

## Done

### Core data/ranking/platform foundations

- Data aggregation engine, multi-lens scoring, pipeline health, and tiered sync infrastructure exist in code and migrations.
- Railway custom server + internal cron infrastructure exists in code and deployment config.
- Data integrity admin visibility exists.
- Ranking lifecycle/pricing/public consistency/public data trust/access-offers slices are substantially implemented across public pages and APIs.

Evidence:

- `supabase/migrations/014_multi_lens_scoring.sql`
- `supabase/migrations/015_tiered_sync_pg_cron.sql`
- `src/app/api/cron/sync/route.ts`
- `src/app/api/pipeline/health/route.ts`
- `src/app/api/health/route.ts`
- public/catalog/ranking surfaces under `src/app/`

### Social commons and moderation

- Social commons foundation is implemented.
- Moderation/reporting/admin queue is implemented.
- Reputation-weighted feed ranking is implemented and marked done in migrations.

Evidence:

- `supabase/migrations/035_social_commons_foundation.sql`
- `supabase/migrations/037_social_post_reports.sql`
- `supabase/migrations/038_mark_thread_reports_and_moderation_done.sql`
- `supabase/migrations/039_mark_reputation_weighted_feed_ranking_done.sql`

### Marketplace trust rails and fulfillment manifests

- Marketplace trust rails and fulfillment manifests are implemented in migrations and routes.
- Expanded marketplace guardrails shipped.

Evidence:

- `supabase/migrations/040_marketplace_trust_rails.sql`
- `supabase/migrations/043_add_marketplace_fulfillment_manifests.sql`
- `supabase/migrations/044_mark_protocol_native_fulfillment_done.sql`
- `supabase/migrations/046_mark_marketplace_guardrails_expanded_done.sql`

### Agent autonomy substrate

- Provider router / ledgers / admin visibility / verifier rollout all exist in code and migrations.
- Resident agents (`pipeline-engineer`, `code-quality`, `ux-monitor`, `verifier`) are registered and scheduled.

Evidence:

- `supabase/migrations/032_agent_autonomy_ledgers.sql`
- `supabase/migrations/033_mark_admin_ledger_dashboard_done.sql`
- `supabase/migrations/034_mark_provider_routing_expansion_done.sql`
- `supabase/migrations/047_add_verifier_agent.sql`
- `supabase/migrations/048_mark_verifier_agent_rollout_done.sql`
- `src/lib/agents/`

## Done Recently And Pushed Live

These were the resumed recovery fixes and are now part of live `main`:

- `a135108` Fix wallet pagination and cron health visibility
- `0abf497` Schedule wallet deposit scans and harden payout validation
- `8b72dd6` Make homepage Supabase client build-safe
- `2384f20` Block duplicate authenticated marketplace purchases
- `5e25aac` Complete marketplace orders only after delivery succeeds
- `5dbfb0f` Surface agent cron failures in health checks
- `490c6eb` Harden search fallback and client handling
- `0532ad8` Add admin-managed agent model overrides
- `0809303` Show provider model usage in agent tasks
- `1c53dca` Fix admin agent tasks build typing
- `8df051a` Normalize sync interval migration version

Additional hardening completed after the initial audit snapshot:

- verified-seller enforcement for withdrawal routes
- recovery-history tracking note tying preserved sessions to the pushed live commit chain

## Partial

### Public data trust and ranking integrity closure

The implementation is broad and real, but closure is partial because the proof layer is uneven:

- code exists across public surfaces
- some ranking-integrity tests were added late during recovery
- not every related plan has a clear completion marker or end-to-end verification note

### Autonomous maintainability control loop

The system can detect, log, schedule, and now more honestly surface agent failures, but it is not yet a fully closed self-healing loop.

What exists:

- structured issue ledger
- resident detectors/verifier
- scheduled cron execution
- issue resolution / escalation helpers

What still looks partial:

- safe playbook coverage is narrow
- admin/operator summary does not yet strongly spotlight unhealthy or auto-disabled agents
- the loop is still better at observation and bounded repair than full unattended recovery across all site subsystems

### User onboarding / API access / wallet documentation

Improved materially, but still partial from a closure perspective:

- profile setup walkthrough exists
- API docs better match wallet and ranking APIs
- wallet funding timing is documented

Still partial because:

- full end-to-end walkthrough validation across all surfaces has not been exhaustively verified
- some older routes and legacy paths still need consistency review

## Open

### Strict plan-by-plan completion proof

Open task:

- produce a per-plan matrix mapping each `docs/plans/*.md` file to `done / partial / open`
- attach file evidence and verification status
- identify historical plans that are superseded versus truly unfinished

### Railway runtime verification

Open task:

- confirm Railway is actually deploying the newest commit after the homepage build-safe change
- verify live cron activity in `cron_runs`
- verify live wallet deposit scan execution on schedule

### Older marketplace order route family

The newer `/api/marketplace/purchase` path is more hardened, but the older `/api/marketplace/orders` family still needs cleanup and consistency review.

Open concerns:

- duplicate/legacy flow overlap
- guest/auth parity
- possible drift between old order creation path and newer purchase path

### Agent/operator visibility polish

Open task:

- surface unhealthy/errored resident agents prominently in admin
- highlight auto-disabled agents and recent failing scheduled runs
- make unattended maintenance status easy to inspect without digging through logs

## Current Position Against The Roadmap

Practical status:

- feature implementation: mostly done
- production hardening: actively underway and materially improved
- runtime verification / operator confidence: still incomplete
- full roadmap closeout proof: not done yet

## Recommended Next Steps

1. Verify Railway is deploying `490c6eb` or newer and not retrying an old build context.
2. Audit and simplify the legacy `/api/marketplace/orders` flow so commerce has one trusted primary path.
3. Add admin-visible unhealthy agent summaries and auto-disabled agent escalation.
4. Produce a file-by-file plan matrix for all `docs/plans/*.md` to finish the audit trail.
