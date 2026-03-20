# Roadmap Audit Status — 2026-03-19

## Scope

This audit covers the implementation burst from the early March milestone work through the resumed recovery work completed on March 19, 2026. It maps roadmap themes to current code evidence and recent live production fixes.

The strict per-file matrix lives in `docs/plans/2026-03-19-plan-matrix.md`.

Reference head at audit time:

- Local / GitHub `main`: `4b0df1305ddc0b54a823c8b025db6c9d19d02845`

Recovery tracking note:

- `docs/plans/2026-03-19-recovery-tracking.md`

## Executive Summary

The roadmap is not fully closed, but the majority of the implementation-heavy slices are in code and many of the highest-risk production gaps have now been fixed live:

- cron scheduling and health visibility materially improved
- wallet funding refresh is now scheduled
- financial integrity protections were added around duplicate purchase and order completion
- resident-agent cron failures now surface as actual failing health signals
- legacy order and auction settlement paths now keep terminal state aligned with payout/refund success instead of closing early

What remains is mostly verification, operator-facing closure, and a few deeper control-loop/runtime hardening tasks rather than broad net-new feature construction.

Verification update after the initial March 19 audit:

- live Railway health remains healthy
- live `cron_runs` and `pipeline_health` confirm active operator/runtime state
- Supabase transfer health is verified directly via service-role and anon reads
- `public.pipeline_health` RLS was enabled remotely
- live auth config was corrected to use `https://aimarketcap.tech` instead of localhost
- browser-verified production auth now supports signup, login, admin access, refresh persistence, and sign-out
- SMTP-backed confirmation and recovery flows are now working again and the temporary autoconfirm fallback has been removed
- live `60e87cb` now returns the safer wallet behavior: `POST /api/marketplace/wallet` responds `503` with an explicit configuration error when chain infrastructure is absent

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
- withdrawal execution now treats failed chain-transfer results as failed withdrawals and refunds automatically
- stale running resident-agent tasks are now auto-failed and escalated before the next run starts
- legacy seller order completion/rejection paths now keep escrow and status transitions in the safe order
- auction settlement now reopens the auction if payout release fails instead of leaving it falsely closed
- leaderboards now surface ranking freshness plus an integrity explainer covering active-first ranks, verified pricing, and value methodology
- model detail headers now surface update freshness alongside the existing View Updates flow
- local browser verification on `http://127.0.0.1:3005` confirmed the new trust surfaces render on `/leaderboards` and `/models/google-gemini-2-5-pro`
- admin agent visibility now surfaces stuck duration, agent slug, verification status/reason, retry count, and escalation timestamps for operator triage, with targeted unit and component coverage in `src/app/(admin)/admin/agents/operator-insights.test.ts` and `src/app/(admin)/admin/agents/agents-content.test.tsx`
- marketplace now explains direct wallet settlement versus assisted escrow in the public hero, listing detail, and wallet touchpoints using `src/lib/marketplace/settlement.ts`, `src/components/marketplace/marketplace-mode-explainer.tsx`, and `src/components/marketplace/settlement-policy-callout.tsx`
- seller-facing marketplace inquiries now flow through the connected contact route with persisted listing metadata and seller-only notifications via `src/app/api/contact/route.ts` and `src/components/marketplace/contact-form.tsx`
- local browser verification on `http://127.0.0.1:3006/marketplace` confirmed the new marketplace fee/explainer surfaces render, and listing detail verification confirmed the settlement explainer renders on `/marketplace/huggingface-hub-models`

## Partial

### Ranking integrity closure

This slice is now materially closed:

- canonical public-family collapse is covered in `src/lib/models/public-families.test.ts`
- lifecycle status parsing and active-vs-all widening are covered in `src/lib/models/lifecycle.test.ts`
- rankings API tests now explicitly prove canonical family output, active-only default gating, `lifecycle=all` widening, lifecycle echoing, and category scoping in `src/app/api/rankings/route.test.ts`
- public leaderboard/model trust surfaces already had targeted page/component proof, so the integrity layer now has both helper/API and public-surface evidence

### Public data trust closure

This slice is now materially closed:

- home, providers, and skills already surfaced freshness/trust cues
- leaderboards now expose ranking freshness and public-integrity guidance directly in the header
- model detail now exposes update freshness in the header instead of burying recency only inside tabs
- targeted component tests and local browser verification now exist for the new public-proof affordances

### Autonomous maintainability control loop

The system can detect, log, schedule, and now more honestly surface agent failures, but it is not yet a fully closed self-healing loop.

What exists:

- structured issue ledger
- resident detectors/verifier
- scheduled cron execution
- issue resolution / escalation helpers
- authenticated admin visibility for retry counts, verification reasons, escalation timestamps, and stuck-task duration on the agents dashboard

What still looks partial:

- safe playbook coverage is narrow
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

Status:

- public `/api/health` has been checked live from production and reports Railway deployment metadata
- public `/api/pipeline/health` has been checked live and returned healthy
- public `/api/search` has been checked live and returned working results
- direct Supabase checks confirm active `cron_runs`, healthy `pipeline_health`, readable `models`/`data_sources`, and working auth admin access

Still open:

- confirm each newer uncommitted local fix has rolled through Railway after release, especially wallet provisioning guardrails
- maintain an authenticated browser proof set for admin/auth flows as deployment changes continue

### Legacy commerce edge-case closure

The old order family and auction settlement paths have been materially hardened during recovery, but commerce still deserves one more final consistency/security pass.

Remaining concerns:

- guest/auth parity on older non-primary flows
- broader end-to-end audit across manifests and manual seller actions
- order-message access control and counterparty notification coverage now exists in `src/app/api/marketplace/orders/[id]/messages/route.test.ts`
- direct auction entry-point coverage now exists in `src/app/api/marketplace/auctions/[id]/accept/route.test.ts` and `src/app/api/marketplace/auctions/[id]/bid/route.test.ts`
- direct-versus-assisted settlement semantics now exist in `src/lib/marketplace/settlement.ts` and are surfaced publicly on marketplace landing/listing/wallet flows
- listing inquiry routing now notifies the listed seller without notifying admins by default, while preserving listing-linked metadata in `contact_submissions` for future investigation
- final documentation/proof that the legacy paths are now subordinate to the safer purchase flow
- wallet provisioning correctness is now in place on live; actual address minting still requires production chain infrastructure

### Agent/operator visibility polish

Open task:

- continue expanding unattended repair playbooks beyond stale-task cleanup and auto-disable escalation
- extend operator visibility beyond the agents dashboard into deeper recovery/action history where needed

## Current Position Against The Roadmap

Practical status:

- feature implementation: mostly done
- production hardening: actively underway and materially improved
- runtime verification / operator confidence: still incomplete
- full roadmap closeout proof: not done yet

## Recommended Next Steps

1. Finish the last commerce edge-case audit around auctions and legacy/manual flows.
2. Extend maintainability from richer operator visibility into broader safe-playbook coverage and recovery history.
3. Complete the connected communications follow-through so seller inquiries, user-facing updates, and admin investigation history are fully consistent end to end.
