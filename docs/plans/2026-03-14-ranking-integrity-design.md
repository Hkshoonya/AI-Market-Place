# Ranking Integrity Redesign

## Goal

Fix the visible ranking/data issues on model and leaderboard pages while upgrading the ranking taxonomy so the product reads as credible to researchers, companies, and serious builders.

## Problems This Redesign Solves

- Model pages can show the same conceptual arena twice with different labels and scores.
- `Capability` exists in data and APIs but is not surfaced as a first-class ranking lens.
- `Browser Agents` support exists in scoring, but public category controls are inconsistent and partially mislabeled.
- `Popularity` blends unlike signals without enough explanation, so rankings can feel arbitrary.
- The current `market cap` framing is too synthetic and too opaque for a research-grade product.

## Design Principles

- Canonicalize source families before display.
- Separate concepts before adjusting weights.
- Prefer explicit evidence summaries over silent sparse-data gaps.
- Keep compatibility with existing APIs where practical.
- Penalize low-evidence economic estimates instead of presenting them as equally trustworthy.

## Section 1: Ranking Taxonomy

The ranking system should expose five public lenses:

- `Capability`
  - Technical ability across benchmarks, arenas, multimodal performance, and agent/browser tasks.
- `Popularity`
  - Blended public attention plus real-world traction.
- `Adoption`
  - Practical footprint: provider presence, usage proxies, routing/integration breadth, and marketplace activity.
- `Value`
  - Capability relative to cost.
- `Economic Footprint`
  - A defensible economic presence/potential metric derived from adoption, monetization, distribution, durability, and confidence.

`Balanced` can remain, but it should be documented as a composite of other explicit lenses rather than a vague default.

## Section 2: Data Normalization And Display

Raw arena and benchmark source names must map into canonical display families.

Examples:

- `chatbot-arena`, `chatbot arena`, `lmarena` -> `Chatbot Arena`
- future variants should be traceable as raw source rows but grouped under the same family

Display rules:

- Model pages show one top-level card per canonical arena family.
- Raw rows remain available as traceability metadata, not duplicated primary rows.
- If a family contains multiple distinct variants, show them as nested variants/snapshots.
- Show evidence depth and confidence where available.

Category and leaderboard display rules:

- Public label `Browser Agents` replaces the ambiguous `Agentic`.
- Category keys used by UI controls must match canonical enums (`agentic_browser`, `embeddings`, `speech_audio`, etc.).
- `Capability` becomes a visible, first-class leaderboard lens rather than an explorer-only concept.
- Sparse categories or models show `Insufficient Coverage` instead of looking broken.

## Section 3: Popularity

`Popularity` remains a combination of all major traction signals, but the composition becomes explicit.

Popularity evidence groups:

- `Community attention`
  - downloads, likes, GitHub stars, bookmarks where available
- `Market attention`
  - trend velocity, news mentions, release buzz, discovery/search signals where available
- `Observed adoption`
  - provider/API presence, routing presence, marketplace transactions, usage proxies
- `Durability`
  - persistence of the above over time rather than one-week spikes

This preserves a broad “combination of all” popularity definition while making the score less arbitrary.

## Section 4: Economic Footprint

The current `market cap` framing should be replaced or strongly reframed.

Recommended public label:

- `Economic Footprint`

Optional secondary/internal label:

- `Market Power Index`

Conceptual model:

`Economic Footprint = Adoption x Monetization x Distribution x Durability x Confidence`

Where:

- `Adoption` captures real observed usage/proxy demand
- `Monetization` captures pricing and revenue potential
- `Distribution` captures provider reach, routing breadth, and access points
- `Durability` captures persistence over time
- `Confidence` penalizes thin evidence and sparse source coverage

Rules:

- No economic metric without an explainer panel.
- Low-confidence models are either penalized or explicitly marked uncertain.
- The metric should never read like a fake company valuation.

## Section 5: Rollout Strategy

Implement in four passes:

1. Correctness and display
   - canonical arena grouping
   - Browser Agents/category control repair
   - Capability surfacing
   - explicit sparse-data states
2. Ranking semantics
   - adoption/economic-footprint derived fields
   - compatibility-preserving API updates
3. UI/explanation
   - lens navigation, explainer text, evidence summaries
4. Calibration and verification
   - regression tests
   - frontier/long-tail/browser-agent spot checks
   - economic-footprint smell tests

## Success Criteria

- No duplicate top-level arena families on model pages.
- `Capability` is visible and navigable on leaderboards.
- `Browser Agents` appears as a clear public category.
- Popularity rankings feel explainable instead of arbitrary.
- Economic rankings read as credible and evidence-weighted, not hype-driven.
