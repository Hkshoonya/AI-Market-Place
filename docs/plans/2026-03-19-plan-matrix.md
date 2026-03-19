# Plan Matrix — 2026-03-19

This is the strict file-by-file audit matrix for `docs/plans/*.md` as of local/GitHub `main` at `ff8c01e`.

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
| `2026-03-12-live-remediation-rollout-design.md` | partial | Live-safe rollout pattern was used, but runtime verification on Railway and some old commerce paths still need closure. |
| `2026-03-12-live-remediation-rollout-plan.md` | partial | Recent live commits addressed cron, wallet, homepage build safety, search, purchase dedupe, and order completion, but full remediation proof is still incomplete. |
| `2026-03-12-low-api-data-source-roadmap.md` | done | Reflected in `028_add_low_api_benchmark_sources.sql`, `030_add_arena_hard_auto_source.sql`, `031_add_vision_arena_source.sql`, and the expanded adapters in `src/lib/data-sources/adapters/`. |
| `2026-03-13-agent-autonomy-design.md` | done | Provider-resilient routing and structured ledgers are implemented in migrations `032-034`, `047-049` and `src/lib/agents/`. |
| `2026-03-13-agent-autonomy-implementation-plan.md` | done | Provider router, issue/deferred ledgers, and verifier rollout are live. |
| `2026-03-13-agent-native-marketplace-social-design.md` | done | Social commons + agent-native marketplace foundation shipped across migrations `035-037`, `040`, `043`, `045`. |
| `2026-03-13-agent-native-marketplace-social-implementation-plan.md` | done | Public actors, threads, feed, and marketplace-social substrate are implemented. |
| `2026-03-13-autonomous-maintainability-plan.md` | partial | Detection, ledgers, scheduled agents, verifier, and failure surfacing now exist, but full unattended remediation coverage remains incomplete. |
| `2026-03-13-marketplace-trust-rails-design.md` | done | Trust-rail schema and listing policy controls shipped in `040_marketplace_trust_rails.sql`. |
| `2026-03-13-marketplace-trust-rails-implementation-plan.md` | done | Guardrail flows, policy scans, and admin visibility exist; later guardrail expansion built on this. |
| `2026-03-13-social-commons-moderation-design.md` | done | Moderation design is implemented through report/tombstone/admin review flows. |
| `2026-03-13-social-commons-moderation-implementation-plan.md` | done | `037_social_post_reports.sql` and `038_mark_thread_reports_and_moderation_done.sql` mark rollout; code exists in commons/admin routes. |
| `2026-03-13-social-feed-ranking-design.md` | done | Reputation-weighted feed modes are implemented. |
| `2026-03-13-social-feed-ranking-implementation-plan.md` | done | `039_mark_reputation_weighted_feed_ranking_done.sql` and `src/lib/social/feed.ts` cover this. |
| `2026-03-14-access-offers-design.md` | done | Shared access-offers layer now powers home/models/providers views. |
| `2026-03-14-access-offers-implementation-plan.md` | done | Implemented and pushed in the recovery slice that unified access-offer signals across catalog surfaces. |
| `2026-03-14-autonomous-commerce-guardrails-design.md` | done | Expanded autonomy/content policy model exists in `045_expand_marketplace_policy_modes.sql`. |
| `2026-03-14-autonomous-commerce-guardrails-implementation-plan.md` | partial | Core guardrails are live and migration `046_mark_marketplace_guardrails_expanded_done.sql` exists, but old order-path cleanup and a full security pass are still open. |
| `2026-03-14-fulfillment-manifests-design.md` | done | Protocol-native manifest design is implemented by `043_add_marketplace_fulfillment_manifests.sql`. |
| `2026-03-14-fulfillment-manifests-implementation-plan.md` | done | `044_mark_protocol_native_fulfillment_done.sql` and current listing/order manifest components cover this. |
| `2026-03-14-public-consistency-design.md` | done | Shared truth/access-offer/public-surface consistency work is in code. |
| `2026-03-14-public-consistency-implementation-plan.md` | done | Recent catalog/home/provider consistency fixes completed this slice materially. |
| `2026-03-14-public-data-trust-design.md` | partial | Trust-oriented public presentation exists, but closure is uneven and not all intended public-proof surfaces are explicitly marked done. |
| `2026-03-14-public-data-trust-implementation-plan.md` | partial | Implemented substantially across ranking, pricing, freshness, and homepage work, but still lacks full end-to-end closure proof. |
| `2026-03-14-ranking-integrity-design.md` | partial | Duplicate/alias/taxonomy fixes landed, but final proof only became stronger after late recovery tests. |
| `2026-03-14-ranking-integrity-implementation-plan.md` | partial | Substantially implemented and now better tested via `f9d3618`, but still not fully closed with a dedicated completion marker. |
| `2026-03-14-ranking-lifecycle-pricing-design.md` | done | Lifecycle-aware rankings and cheapest-verified pricing behavior exist in public pages. |
| `2026-03-14-ranking-lifecycle-pricing-implementation-plan.md` | done | Recovery work unified cheapest verified access signals and made ranking lens/lifecycle behavior materially consistent. |
| `2026-03-19-roadmap-audit-status.md` | done | Current thematic audit summary, now pushed live. |

## Highest-value remaining open work

1. Verify Railway runtime from live deploy state, not only repo state:
   cron execution cadence, `cron_runs`, homepage freshness movement, and latest deployed SHA.
2. Finish old marketplace order-path cleanup so the legacy `/api/marketplace/orders` family cannot drift from the newer purchase path.
3. Continue autonomous maintainability hardening:
   broaden safe playbooks, escalation paths, and unattended repair coverage beyond detection and visibility.
4. Close public-data-trust and ranking-integrity proof:
   add any missing end-to-end verification and mark completion explicitly where appropriate.
