# Public Consistency Implementation Plan

Date: 2026-03-14

## Phase 1: Shared Truth Layer

- Add shared pricing presenter in `src/lib/models/pricing.ts` or a companion helper:
  - official company price
  - cheapest verified route
  - other verified routes
  - compact label helpers
- Add shared value presenter:
  - compact estimated value label
  - expanded methodology/factors payload
- Add a small shared `coverage state` helper for public empty states.

## Phase 2: Public Surface Rewire

- Homepage:
  - use shared compact pricing/value helpers
- Leaderboards:
  - use shared compact pricing/value helpers
  - keep tracked non-active section collapsed near the bottom
- Models directory and grids/cards:
  - stop using ad hoc lowest-price logic
  - show estimated value consistently
- Model detail:
  - pricing tab consumes official + cheapest + alternates from shared helper
  - trading/value surfaces consume shared explanation
- Skills page:
  - add differentiated skill context
  - surface value/pricing consistently but as secondary signals
- Providers page:
  - add provider-specific narrative and aggregate stats
  - surface official pricing posture and strongest model lineup

## Phase 3: Pricing Trust Tightening

- Reclassify curated deployment pricing so it is not treated as official company pricing.
- Prefer provider-first website/doc pricing in public presentation.
- Label routed/broker pricing explicitly.
- Ensure tables say `Cheapest Verified` while detail views say `Official` vs `Cheapest`.

## Phase 4: Verification

- Add tests for:
  - pricing preference logic
  - compact vs expanded pricing labels
  - market value consistency helpers
  - skills/provider page differentiated content
  - models directory / leaderboard rendering with shared helpers
- Run:
  - targeted tests
  - `npm run build`
  - local HTTP checks for `/`, `/leaderboards`, `/models`, `/providers/[slug]`, `/skills`

## Success Criteria

- same model shows the same compact price/value semantics across homepage, leaderboards, models, and provider surfaces
- official company pricing is separated from broker/router pricing
- estimated value appears consistently where relevant
- skills and providers pages feel distinct, not redundant
- no public page silently computes its own incompatible price/value story
