# Access Offers Design

Build a shared public `Access Offers` layer so subscription, API, and deployment access can be surfaced consistently across the site. The immediate goal is a `Top Subscription Providers` table on the homepage, ranked for user value and trust first, with partner-supported links kept secondary and clearly disclosed.

## Goals

- Add a homepage table for the best subscription-style AI access products.
- Keep rankings objective: value, trust, affordability, and utility breadth first.
- Reuse the same truth layer on provider, model, and skills surfaces so pages are informative without becoming redundant.
- Keep outbound labels action-first: `Subscribe`, `Start Free Trial`, `Get API Access`, `Deploy`, `View Plan`.
- Keep monetization secondary: partner-supported links may be used, but should never influence rank directly.

## Data Model

Use existing public data first:

- `deployment_platforms`
  - official platform identity
  - type (`subscription`, `api`, `hosting`, `self-hosted`, `local`)
  - base URL
  - partner/affiliate metadata
- `model_deployments`
  - which models are available through which platform
  - monthly pricing and other deployment pricing
  - free-tier notes
  - availability status
- `models`
  - model quality, capability, adoption, and economic-footprint signals
  - category and provider coverage

No schema rewrite is required for the initial subscription slice. The ranking helper should derive subscription offers by aggregating `available` monthly deployments attached to `subscription` platforms.

## Ranking Logic

Each subscription offer gets a `subscription_access_score` based on:

- `value`
  - quality/capability of covered models
  - economic-footprint strength of covered models
- `trust`
  - official first-party platform
  - direct tracked access rather than inferred availability
  - stable plan URL and known monthly price
- `affordability`
  - lower monthly cost should materially help rank
- `utility breadth`
  - number of meaningful categories served
  - diversity of top-tier models served

Referral/partner status is not a ranking factor.

## Public Labels

Primary CTA labels:

- `Subscribe`
- `Start Free Trial`
- `Get API Access`
- `Deploy`
- `View Plan`

Context labels:

- `Official`
- `Verified`
- `Related Access`

Partner disclosure should be subtle and secondary, for example:

- `Partner-supported link`
- `This link may support AI Market Cap`

## Surface Design

### Homepage

- Add `Top Subscription Providers` table.
- Show:
  - rank
  - provider/plan
  - monthly price
  - value/trust signal
  - best-for summary
  - action button
- Use partner-supported links when present, but do not foreground that in the CTA.

### Provider Pages

- Show a compact access-offer summary for that provider.
- Explain whether the provider is mainly consumer subscription, developer API, or hybrid.

### Model Pages

- Keep model-specific deployment detail primary.
- Add a compact `Best Access Paths` summary built from the shared layer.

### Skills Page

- Use access-offer summaries as discovery context for capability areas, not as generic clutter.

## Guardrails

- Do not treat inferred access as direct truth.
- Do not rank affiliate-bearing plans higher because they monetize.
- Prefer official pricing when available.
- If confidence is weak, label the offer as `Related Access` or omit it from the homepage ranking.

