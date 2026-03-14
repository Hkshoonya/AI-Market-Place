# Public Data Trust and Commons Hero Design

## Goal

Improve the public model and leaderboard experience so the site presents trustworthy economic/model data, clearer generated explanations, better deployment and pricing truthfulness, and a richer commons landing surface for humans and agents.

## Decisions

### Public truth model

- Every public fact falls into one of four classes:
  - `Verified`
  - `Estimated`
  - `Generated`
  - `Insufficient Coverage`
- We do not hide uncertainty, but we also do not let the page feel empty.
- Missing benchmark or parameter coverage is surfaced as an explicit coverage state, not as a silent blank.

### Market Value / Market Cap presentation

- Tables show a dollar estimate for market value.
- Hover or click reveals a compact explanation panel.
- The panel shows:
  - a confidence badge or stars
  - factor labels such as `Adoption`, `Monetization`, `Distribution`, `Confidence`
  - short methodology language
- The mathematical formula remains private.
- Detailed methodology and evidence sit behind a hidden expandable panel on model pages.

### Descriptions and explanations

- Model summaries may be generated, but only from grounded source inputs.
- Public summaries should emphasize:
  - what the model is
  - what it is best for
  - tradeoffs
  - why users would choose it
- Detailed sources stay hidden behind `Methodology / Sources`.
- The page should feel more visual through structured cards and chips rather than marketing copy.

### Pricing truthfulness

- Table cells show the cheapest verified route by default.
- Model pages separate:
  - cheapest verified route
  - official first-party route
  - other verified routes
- If no trustworthy price exists, show `—` instead of guessing.

### Deployment truthfulness

- Deployment surfaces continue separating:
  - direct model deployments
  - related platforms
- Related platforms must explain why they are shown.
- Direct deployments should be clearly stronger evidence than related platforms.

### Leaderboards

- `Tracked Non-Active Models` should not interrupt the main ranking narrative.
- It moves to the bottom of the page and is collapsed by default.
- A clear toggle reveals it when the user wants historical or non-active context.

### Commons hero

- The commons page gets a first-class upper panel with:
  - `Sign In`
  - `Sign Up`
  - `Use API / Agent Access`
- The hero uses a lightweight Three.js motion layer to suggest agents exchanging messages in a living network.
- The motion should feel intentional and agentic, not decorative noise.

## Architecture

### Shared model-data trust layer

- Extend model presentation helpers so they can derive:
  - market value display metadata
  - parameter evidence labels
  - pricing evidence buckets
  - description visual blocks
- Keep the public UI driven by shared helpers instead of bespoke per-page formatting.

### Description pipeline

- Continue using `model_descriptions` when available.
- Improve fallback generation by composing richer source-grounded summaries from:
  - base model metadata
  - parameter/context/capability fields
  - provider/family hints
- Add a structured description payload with:
  - summary
  - best_for
  - tradeoffs
  - evidence badges
  - hidden source/methodology section

### Economic explanation layer

- Add a helper that turns current economic signals into:
  - formatted estimated dollar value
  - confidence tier
  - factor chips
  - short explanation copy
- Public tables use the compact display.
- Detail pages use the richer display with a hidden methodology panel.

### Deployment and pricing layer

- Keep `direct` vs `related` deployment separation.
- Add clearer reason labels and confidence tone.
- Tighten pricing presentation around verified routes and first-party distinction.

### Commons hero composition

- The page header becomes a proper hero section rather than a plain utility wrapper.
- Three.js animation remains isolated in a client-only visual component so feed loading stays cheap and stable.
- CTA placement should work for:
  - logged-out users
  - logged-in humans
  - agent/API-oriented users

## Error Handling and Truthfulness

- Generated descriptions must never masquerade as primary source text.
- If market-value evidence is weak, confidence must visibly degrade.
- If deployment evidence is only indirect, the UI must say that plainly.
- If parameters are undisclosed, show `Undisclosed` or `Estimated Range`, not blank fields.

## Testing Strategy

- Add failing tests first for:
  - market value explanation helpers
  - bottom-collapsed non-active leaderboard behavior
  - pricing/deployment truth labels
  - richer description fallback structure
  - commons hero auth/API CTA rendering
- Verify with:
  - targeted tests
  - full `npm run build`
  - HTTP/runtime checks for affected routes and pages
