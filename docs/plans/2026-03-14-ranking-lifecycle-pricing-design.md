# Ranking Lifecycle and Pricing Design

## Goal

Make public rankings lifecycle-aware, make leaderboard lens controls actually drive ranking behavior, and make model pricing truthfully show the cheapest verified route by default while keeping official and related pricing context visible.

## Decisions

### Lifecycle policy

- Only `active` models are ranked by default.
- `beta`, `preview`, `deprecated`, and `archived` models remain tracked.
- Public pages expose a one-click toggle to include non-active models.
- Non-active models are visibly labeled with lifecycle badges.
- Deprecated models get a dedicated surfaced section instead of being silently mixed into default rankings.

### Ranking behavior

- The top lens cards on `/leaderboards` become real controls, not decorative cards.
- The active lens is reflected in the URL and drives:
  - leaderboard explorer sorting
  - category leaderboard primary ordering
  - top-table ordering and distribution labeling on the main leaderboards page
- Category leaderboards follow the same lifecycle filter as the main leaderboard.

### Pricing behavior

- Tables show the cheapest verified route by default.
- Open-weight models without paid API pricing still show `Free`.
- Expanded pricing views separate:
  - cheapest verified route
  - official first-party route
  - other verified routes
- Related deployment platforms remain visible, but they must be clearly explained as related access paths rather than confirmed model-specific deployments.

## Architecture

### Shared helpers

- Add lifecycle helpers to normalize status groups and expose:
  - active-only filtering
  - include-non-active filtering
  - non-active labels and badge styles
- Extend pricing helpers to derive:
  - cheapest verified price
  - official first-party price
  - verified route summaries for table/detail usage

### URL state

- Use URL params as the public contract:
  - `lens=<capability|popularity|adoption|economic|value>`
  - `lifecycle=<active|all>`
- Main leaderboard page, category pages, and models directory all read the same lifecycle contract.

### UI updates

- `/leaderboards`
  - lens cards become interactive links/buttons
  - default top table follows the active lens
  - add lifecycle toggle
  - add dedicated non-active summary section when hidden
- `/leaderboards/[category]`
  - add lifecycle toggle
  - use active lens for ordering and labeling
- `/models`
  - add lifecycle toggle
  - show lifecycle badges for non-active results
- `/models/[slug]`
  - surface lifecycle status clearly when non-active
  - pricing tab gets explicit cheapest vs official summaries

## Error handling and truthfulness

- If pricing exists but no route is verified enough for table display, show `—` instead of guessing.
- If a model is non-active and rankings are hidden by default, show a clear explanation instead of a missing-state feel.
- If a model only has related deployment platforms, explain why they are related and not direct.

## Testing strategy

- Add failing tests first for:
  - lifecycle filtering behavior
  - interactive lens navigation state
  - cheapest verified pricing selection
  - non-active badge rendering
- Then update existing page/component tests for the new URL-state behavior.

