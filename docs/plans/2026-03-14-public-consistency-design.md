# Public Consistency Design

Date: 2026-03-14

## Goal

Make public pricing, estimated market value, and page narratives consistent across:

- homepage
- leaderboards
- models directory
- model detail pages
- skills page
- providers page

At the same time, make each page meaningfully different instead of repeating the same information with minor layout changes.

## User Feedback Incorporated

- `Cheapest Verified` is wrong when it prefers routers over company website pricing.
- estimated value appears only in `Market Leaders` instead of being treated as a first-class public signal.
- pricing and value are inconsistent across `Models`, `Skills`, and `Providers`.
- pages feel redundant instead of category-specific.
- deprecated / non-active handling must stay clean and explicit.

## Root Causes

1. Pricing truth is split across multiple helpers and pages.
2. `deployment-pricing` still relies on curated static records instead of a provider-first public pricing policy.
3. Pages consume raw `model_pricing` rows directly instead of a shared public pricing model.
4. Estimated value / economic signals are only surfaced in selected tables, not treated as part of the common public model contract.
5. `Skills` and `Providers` pages are still older list/report pages and do not share the upgraded public explanation/value/pricing layer.

## Public Truth Model

Every public model-facing surface should consume the same shared presentation layer:

- `official_company_price`
  - first-party provider website / official API price
- `cheapest_verified_route`
  - lowest trusted route, which may be a broker/router
- `pricing_confidence`
  - how strong the pricing evidence is
- `market_value_explanation`
  - shared estimated dollar value plus hidden methodology summary
- `coverage_state`
  - verified / estimated / generated / insufficient coverage

Rules:

- table/default compact views show:
  - `Cheapest Verified`
  - `Estimated Market Value`
- expanded pricing/detail views show:
  - `Official Company Price`
  - `Cheapest Verified Route`
  - `Other Verified Routes`
- no public page should compute pricing ad hoc from raw rows anymore.

## Pricing Policy

### Default compact display

- show cheapest verified route in tables and compact cards
- if no verified route exists:
  - show `Free` for open-weight models when appropriate
  - otherwise show `Unavailable`

### Expanded display

- always separate:
  - `Official`
  - `Cheapest Verified`
  - `Other Verified Routes`

### Verification priority

1. official company/provider website pricing
2. official API/provider docs pricing
3. trusted routed/broker pricing
4. inferred/open-weight fallback

Curated static deployment pricing should no longer be treated as equivalent to official company pricing.

## Page Roles

### Homepage

Purpose:
- discovery
- market snapshot
- high-signal leaders

Should emphasize:
- estimated market value
- cheapest verified route
- why a model is leading now

Should not try to be a full database table.

### Leaderboards

Purpose:
- rank by lens
- compare top models
- explain why ranks exist

Should emphasize:
- lens-specific rank
- estimated market value
- cheapest verified route
- lifecycle-aware ranking

Non-active tracked table stays collapsed and near the bottom.

### Models Directory

Purpose:
- broad searchable inventory

Should emphasize:
- parameter footprint
- lifecycle
- cheapest verified route
- estimated value
- high-level ranking/lens signal

### Model Detail

Purpose:
- deep explanation
- evidence
- pricing and deploy clarity

Should emphasize:
- richer generated/source-grounded explanation
- official vs cheapest verified price
- deployment clarity
- market value explanation
- evidence coverage and benchmark context

### Skills

Purpose:
- answer `which models are best at this work`

Should emphasize:
- skill-specific evidence
- best-in-skill ranking
- estimated value only as supporting context
- cheapest verified route only as buyer context

Should not feel like the generic models directory.

### Providers

Purpose:
- answer `what is this company/provider strong at`

Should emphasize:
- provider strategy footprint
- official pricing posture
- strongest categories
- best active models
- aggregate market-value / adoption footprint

Should not be just another raw model table.

## Market Value Presentation

Public table/card:

- estimated dollar figure
- no raw formula disclosure

Expanded view:

- factor labels:
  - Adoption
  - Monetization
  - Distribution
  - Confidence
- stars / confidence indicator
- hidden methodology panel with evidence language, not raw coefficients

## Implementation Direction

Create one shared public helper layer under `src/lib/models/` for:

- pricing presentation
- value presentation
- coverage / uncertainty badges
- page-specific summary cards

Then rewire pages to use the same helpers instead of raw local logic.

## Deferred But Related

- stronger official-company pricing ingestion
- provider website pricing scrapers / parsers where public docs exist
- skills/provider-specific visual summaries
- long-tail benchmark coverage expansion
