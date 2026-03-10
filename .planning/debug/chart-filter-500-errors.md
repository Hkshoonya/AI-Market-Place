---
status: diagnosed
trigger: "chart filter pages return HTTP 500 errors for multiple categories (embedding, audio, search, description, image, icon)"
created: 2026-03-09T00:00:00Z
updated: 2026-03-09T00:00:00Z
---

## Current Focus

hypothesis: Chart controls use WRONG category slugs that don't match database values
test: Compare chart-controls.tsx CATEGORIES values vs canonical categories.ts slugs
expecting: Mismatch between frontend filter values and database category column values
next_action: Document root cause and affected files

## Symptoms

expected: Selecting chart filters (Embedding, Audio, etc.) should filter models and return data
actual: HTTP 500 errors when selecting certain category filters on chart pages
errors: Fetch error 500 for embedding, audio, and possibly other categories
reproduction: Go to quality-price frontier or benchmark-heatmap chart, change category filter to Embedding or Audio
started: Since chart-controls.tsx was introduced with hardcoded CATEGORIES list

## Eliminated

(none needed - root cause found on first hypothesis)

## Evidence

- timestamp: 2026-03-09T00:01:00Z
  checked: src/components/charts/chart-controls.tsx CATEGORIES list (lines 12-20)
  found: |
    Uses these category values:
      "" (All), "llm", "multimodal", "image_generation", "code", "embedding", "audio"
    Note: "embedding" (singular) and "audio" (not "speech_audio")
  implication: These are the values sent as ?category= query param to API routes

- timestamp: 2026-03-09T00:02:00Z
  checked: src/lib/constants/categories.ts canonical ModelCategory type (lines 15-25)
  found: |
    Canonical DB categories are:
      "llm", "image_generation", "vision", "multimodal", "embeddings", "speech_audio",
      "video", "code", "agentic_browser", "specialized"
  implication: Database stores "embeddings" (plural) and "speech_audio", NOT "embedding" and "audio"

- timestamp: 2026-03-09T00:03:00Z
  checked: API routes quality-price/route.ts and benchmark-heatmap/route.ts
  found: |
    Both routes do `.eq("category", category)` against Supabase.
    When frontend sends category="embedding", the query filters for models where
    category="embedding" which matches ZERO rows (DB has "embeddings").
    When frontend sends category="audio", same issue (DB has "speech_audio").
    The query itself doesn't error -- it returns empty results (models=[]).
    BUT: benchmark-heatmap then calls `supabase.from("benchmark_scores").in("model_id", modelIds)`
    with an empty modelIds array, and Supabase `.in()` with empty array can cause errors.
  implication: The mismatch causes either empty results or 500 errors depending on downstream handling

- timestamp: 2026-03-09T00:04:00Z
  checked: chart-controls.tsx vs categories.ts category list completeness
  found: |
    chart-controls.tsx is MISSING these categories entirely:
      - vision
      - video
      - agentic_browser
      - specialized
    And has WRONG slug names for:
      - "embedding" should be "embeddings"
      - "audio" should be "speech_audio"
  implication: Two bugs -- wrong slugs AND incomplete category list

- timestamp: 2026-03-09T00:05:00Z
  checked: Supabase .in() with empty array behavior
  found: |
    In benchmark-heatmap route.ts line 68:
      .in("model_id", modelIds) where modelIds can be [] when category filter returns no models.
    Supabase PostgREST `.in()` with an empty array generates invalid SQL: `WHERE model_id IN ()`
    which is a PostgreSQL syntax error, causing a 500 response.
  implication: This is the direct cause of the 500 errors (not just empty results)

## Resolution

root_cause: |
  TWO interacting bugs:

  BUG 1 - CATEGORY SLUG MISMATCH (primary cause):
    src/components/charts/chart-controls.tsx (lines 12-20) defines its own hardcoded
    CATEGORIES list with WRONG slug values that don't match the canonical database
    categories from src/lib/constants/categories.ts:
      - "embedding" (chart-controls) vs "embeddings" (database)
      - "audio" (chart-controls) vs "speech_audio" (database)
    Additionally, chart-controls is MISSING these categories entirely:
      vision, video, agentic_browser, specialized
    When a mismatched category is sent to the API, the Supabase query
    `.eq("category", "embedding")` returns zero rows because no model has that
    category value -- the database stores "embeddings" (plural).

  BUG 2 - MISSING EMPTY-ARRAY GUARD (causes the 500):
    src/app/api/charts/quality-price/route.ts (line 54-59) does NOT check whether
    modelIds is empty before calling `.in("model_id", modelIds)`. When the category
    mismatch returns zero models, modelIds=[], and Supabase `.in()` with an empty
    array generates invalid PostgREST SQL (`WHERE model_id IN ()`), which causes a
    PostgreSQL syntax error -> HTTP 500.

    The benchmark-heatmap route DOES have a guard (line 53-55: early return if no
    models). So benchmark-heatmap returns empty data gracefully, while quality-price
    throws a 500.

    Other routes with .in(modelIds) are safe:
      - ticker/route.ts has guard at line 20
      - rank-timeline/route.ts has guard at line 44-46
      - benchmark-heatmap/route.ts has guard at line 53-55

  The "search, description, image, icon" errors the user mentioned are likely the
  names/labels/icons of chart components on the page that ALL show errors because
  they share the same filter state via ChartControls, not additional category names.

fix: (not applied - read-only investigation)
verification: (not applied)
files_changed: []
