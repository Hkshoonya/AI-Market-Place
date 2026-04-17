# Hallucination Columns and Reliability Signals Plan

Status: deferred design slice, intentionally scheduled after current deployment, data, and UX stabilization work

## Goal

Add a public hallucination and reliability surface for tracked models so users can see where a model is strong, where it needs caution, and how much factual-risk discount it should get in rankings and recommendations.

This is meant to support:

1. model detail pages
2. leaderboards and rankings
3. search results
4. compare views

## Why This Is Deferred

The current priority is still:

1. deployment flow clarity
2. benchmark/data pipeline integrity
3. ranking honesty and source trust

Adding a hallucination column before the evidence pipeline is stable would create a false precision problem. The metric should only ship once the site can show:

- source provenance
- update freshness
- benchmark or evaluation methodology
- clear separation between official, third-party, and estimated signals

## What Should Exist Later

### 1. Public columns

Each tracked model should eventually support:

- `hallucination_risk`
- `factual_reliability`
- `confidence_in_hallucination_signal`
- `hallucination_last_verified_at`
- `hallucination_sources`

### 2. UI presentation

Public surfaces should use plain language, for example:

- `Lower factual risk`
- `Mixed reliability`
- `Higher hallucination risk`

The UI should not imply a fake scientific certainty. It should always show:

- latest update date
- evidence confidence
- source type

### 3. Ranking integration

This metric should not be a decorative badge only. It should eventually affect:

- top-model eligibility
- ranking confidence
- recommendation ordering

That gives the site a proper way to nerf models that benchmark well but remain weak on factual stability in real use.

## Evidence Sources To Evaluate

Potential future inputs:

- provider-published hallucination or factuality evaluations
- trusted benchmark families already tracked in the data layer
- reliable third-party eval suites with reproducible methodology
- controlled internal scoring only if provenance is explicit and the method is documented

Avoid:

- single social posts
- unverifiable anecdotal claims
- hand-entered scalar scores without methodology

## Shipping Rule

Do not expose hallucination columns publicly until the product can answer all of these:

1. what exactly was measured
2. who measured it
3. when it was last updated
4. how trustworthy the source is
5. whether the score should affect ranking or only labeling
