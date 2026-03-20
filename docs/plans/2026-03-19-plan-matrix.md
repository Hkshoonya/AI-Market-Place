# Plan Matrix — 2026-03-19

This is the strict file-by-file audit matrix for `docs/plans/*.md` as of local/GitHub `main` at `4b0df13`.

Status legend:

- `done`: implemented with clear code and/or migration evidence
- `partial`: materially implemented, but closure, verification, or operator/runtime proof is still incomplete
- `open`: still needs meaningful implementation or verification work
- `superseded`: strategic/design reference that was absorbed by later implementation plans or shipped work

| Plan file | Status | Evidence / note |
| --- | --- | --- |
| `2026-02-27-data-aggregation-engine-design.md` | done | Core pipeline exists in `src/app/api/cron/sync/route.ts`, `src/lib/data-sources/*`, and foundational migrations including `001`, `002`, `027`. |
| `2026-02-27-data-aggregation-engine-plan.md` | done | Production ingestion engine, state tracking, and sync endpoints are live; later low-API additions extended the same system. |
| `2026-03-01-affiliate-strategy.md` | partial | Affiliate/deploy links and access offers exist via `013_affiliate_links.sql` and public access-offer surfaces, but revenue/partner operations are ongoing rather than closed. |
| `2026-03-01-phase6-implementation-plan.md` | done | Covered by `007_phase6_market_cap_agent_deploy.sql` and shipped market-cap, deploy, trading, and model-description surfaces. |
| `2026-03-01-phase6-market-cap-agent-score-trading-deploy-design.md` | done | Implemented by phase 6 migrations and current model detail/catalog pages. |
| `2026-03-02-multi-lens-scoring-plan.md` | done | `014_multi_lens_scoring.sql`, `015_tiered_sync_pg_cron.sql`, ranking APIs, and leaderboard surfaces are in code. |
| `2026-03-02-multi-lens-scoring-redesign.md` | done | Same shipped lens system as above. |
| `2026-03-12-audit-fix-plan.md` | partial | Many critical fixes landed across March 12-19, but not every original audit item has a fresh end-to-end verification marker. |
| `2026-03-12-live-remediation-rollout-design.md` | partial | Live-safe rollout pattern was used and live health/search verification now exists, but newest-commit Railway rollout proof is still ongoing. |
| `2026-03-12-live-remediation-rollout-plan.md` | partial | Recent live commits addressed cron, wallet, homepage build safety, search, legacy order integrity, and auction settlement fallback, but full remediation proof is still incomplete. |
| `2026-03-12-low-api-data-source-roadmap.md` | done | Reflected in `028_add_low_api_benchmark_sources.sql`, `030_add_arena_hard_auto_source.sql`, `031_add_vision_arena_source.sql`, and the expanded adapters in `src/lib/data-sources/adapters/`. |
| `2026-03-13-agent-autonomy-design.md` | done | Provider-resilient routing and structured ledgers are implemented in migrations `032-034`, `047-049` and `src/lib/agents/`. |
| `2026-03-13-agent-autonomy-implementation-plan.md` | done | Provider router, issue/deferred ledgers, and verifier rollout are live. |
| `2026-03-13-agent-native-marketplace-social-design.md` | done | Social commons + agent-native marketplace foundation shipped across migrations `035-037`, `040`, `043`, `045`. |
| `2026-03-13-agent-native-marketplace-social-implementation-plan.md` | done | Public actors, threads, feed, and marketplace-social substrate are implemented. |
| `2026-03-13-autonomous-maintainability-plan.md` | partial | Detection, ledgers, scheduled agents, verifier, auto-disable escalation, stale-task auto-fail, and richer admin operator context now exist via `src/app/(admin)/admin/agents/agents-content.tsx`, `src/app/(admin)/admin/agents/operator-insights.ts`, and targeted tests, but full unattended remediation coverage remains incomplete. |
| `2026-03-13-marketplace-trust-rails-design.md` | done | Trust-rail schema and listing policy controls shipped in `040_marketplace_trust_rails.sql`. |
| `2026-03-13-marketplace-trust-rails-implementation-plan.md` | done | Guardrail flows, policy scans, and admin visibility exist; later guardrail expansion built on this. |
| `2026-03-13-social-commons-moderation-design.md` | done | Moderation design is implemented through report/tombstone/admin review flows. |
| `2026-03-13-social-commons-moderation-implementation-plan.md` | done | `037_social_post_reports.sql` and `038_mark_thread_reports_and_moderation_done.sql` mark rollout; code exists in commons/admin routes. |
| `2026-03-13-social-feed-ranking-design.md` | done | Reputation-weighted feed modes are implemented. |
| `2026-03-13-social-feed-ranking-implementation-plan.md` | done | `039_mark_reputation_weighted_feed_ranking_done.sql` and `src/lib/social/feed.ts` cover this. |
| `2026-03-14-access-offers-design.md` | done | Shared access-offers layer now powers home/models/providers views. |
| `2026-03-14-access-offers-implementation-plan.md` | done | Implemented and pushed in the recovery slice that unified access-offer signals across catalog surfaces. |
| `2026-03-14-autonomous-commerce-guardrails-design.md` | done | Expanded autonomy/content policy model exists in `045_expand_marketplace_policy_modes.sql`. |
| `2026-03-14-autonomous-commerce-guardrails-implementation-plan.md` | partial | Core guardrails are live and migration `046_mark_marketplace_guardrails_expanded_done.sql` exists; recovery work hardened legacy order closing, withdrawal handling, auction settlement, seller-only inquiry notifications, and dual-settlement explanation surfaces, but a final commerce security/playbook pass is still open. |
| `2026-03-14-fulfillment-manifests-design.md` | done | Protocol-native manifest design is implemented by `043_add_marketplace_fulfillment_manifests.sql`. |
| `2026-03-14-fulfillment-manifests-implementation-plan.md` | done | `044_mark_protocol_native_fulfillment_done.sql` and current listing/order manifest components cover this. |
| `2026-03-14-public-consistency-design.md` | done | Shared truth/access-offer/public-surface consistency work is in code. |
| `2026-03-14-public-consistency-implementation-plan.md` | done | Recent catalog/home/provider consistency fixes completed this slice materially. |
| `2026-03-14-public-data-trust-design.md` | done | Public trust surfaces now span home, providers, skills, leaderboards, and model detail, including explicit freshness cues in `src/app/(rankings)/leaderboards/page.tsx` and `src/app/(catalog)/models/[slug]/_components/model-header.tsx`. |
| `2026-03-14-public-data-trust-implementation-plan.md` | done | Freshness/trust affordances now have targeted regression coverage in `src/app/(rankings)/leaderboards/page.test.tsx` and `src/app/(catalog)/models/[slug]/_components/model-header.test.tsx`, plus local browser proof on `/leaderboards` and `/models/google-gemini-2-5-pro`. |
| `2026-03-14-ranking-integrity-design.md` | done | Duplicate/alias/taxonomy fixes are now backed by targeted proof in `src/lib/models/public-families.test.ts`, `src/lib/models/lifecycle.test.ts`, `src/app/api/rankings/route.test.ts`, and the public leaderboard/model page tests. |
| `2026-03-14-ranking-integrity-implementation-plan.md` | done | Rankings API and helper coverage now explicitly prove canonical family collapse, lifecycle filtering/echo, category scoping, and active-first widening behavior, closing the remaining integrity-proof gap. |
| `2026-03-14-ranking-lifecycle-pricing-design.md` | done | Lifecycle-aware rankings and cheapest-verified pricing behavior exist in public pages. |
| `2026-03-14-ranking-lifecycle-pricing-implementation-plan.md` | done | Recovery work unified cheapest verified access signals and made ranking lens/lifecycle behavior materially consistent. |
| `2026-03-19-recovery-tracking.md` | done | Recovery exports under `recovery/codex-history/` are now mapped to the resumed March 19 live commit chain. |
| `2026-03-19-roadmap-audit-status.md` | done | Current thematic audit summary, now pushed live. |
| `2026-03-20-marketplace-dual-settlement-contact-design.md` | partial | Product direction is now implemented materially in `src/lib/marketplace/settlement.ts`, `src/app/(marketplace)/marketplace/page.tsx`, `src/components/marketplace/contact-form.tsx`, and `src/app/api/contact/route.ts`, but final communications/admin-history closure still needs broader follow-through. |
| `2026-03-20-marketplace-dual-settlement-contact-implementation-plan.md` | partial | Settlement policy helpers, explanatory marketplace UX, seller-targeted contact routing, and reusable settlement callouts are implemented with tests; remaining work is broader communications/history/operator closure rather than the core dual-settlement model. |

## Highest-value remaining open work

1. Release the newer local working-tree fixes beyond live `3bebb83`:
   completed: production now serves `60e87cb`, and browser verification confirms auth refresh/admin/sign-out plus safe wallet `503` behavior when chain infra is absent.
2. Continue autonomous maintainability hardening:
   broaden safe playbooks and unattended repair coverage beyond the now-richer operator visibility for escalations and stuck tasks.
3. Finish the final commerce edge-case and communications audit across auctions, manual seller flows, and inquiry-thread/operator history.
4. Keep tightening the final commerce and maintainability gaps rather than broadening scope:
   ranking integrity now has explicit helper/API/public-surface proof.
